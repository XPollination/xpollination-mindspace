#!/usr/bin/env node
/**
 * Version Twin Deploy — station apply engine
 * Usage: node scripts/deploy.js <version> <station> [--rollback]
 *
 * Reads version twin, executes apply_steps (or rollback_steps).
 * No Docker rebuild — symlink swap + migrations + restart.
 *
 * Examples:
 *   node scripts/deploy.js v0.0.39 beta          # deploy to beta
 *   node scripts/deploy.js v0.0.38 beta --rollback # rollback beta
 *   node scripts/deploy.js v0.0.39 prod           # deploy to prod
 */

import { readFileSync, existsSync, symlinkSync, rmSync, readlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const [,, version, station, ...flags] = process.argv;
const isRollback = flags.includes('--rollback');

if (!version || !station) {
  console.error('Usage: node scripts/deploy.js <version> <station> [--rollback]');
  console.error('Stations: beta, prod, local');
  process.exit(1);
}

// Load station config
const stationConfig = JSON.parse(readFileSync(join(__dirname, 'station-config.json'), 'utf8'));
const config = stationConfig[station];
if (!config) {
  console.error(`Unknown station: ${station}. Available: ${Object.keys(stationConfig).join(', ')}`);
  process.exit(1);
}

console.log(`\n═══ Version Twin Deploy ═══`);
console.log(`Version: ${version}`);
console.log(`Station: ${station}`);
console.log(`Mode: ${isRollback ? 'ROLLBACK' : 'DEPLOY'}\n`);

// Load version twin (from JSON file or DB)
let twin = null;
const twinPath = join(config.vizRoot, 'versions', version, 'version-twin.json');
if (existsSync(twinPath)) {
  twin = JSON.parse(readFileSync(twinPath, 'utf8'));
  console.log(`▸ Loaded version twin from ${twinPath}`);
} else {
  // Try DB
  try {
    const db = new Database(config.db, { readonly: true });
    const row = db.prepare('SELECT * FROM version_twins WHERE version = ?').get(version);
    db.close();
    if (row) {
      twin = {
        version: row.version,
        parent_version: row.parent_version,
        viz_path: row.viz_path,
        migrations: JSON.parse(row.migrations_json || '[]'),
        feature_flags: JSON.parse(row.feature_flags_json || '{}'),
        apply_steps: JSON.parse(row.apply_steps_json),
        rollback_steps: JSON.parse(row.rollback_steps_json || '[]'),
        requires_rebuild: !!row.requires_rebuild,
        changelog: row.changelog,
      };
      console.log(`▸ Loaded version twin from DB`);
    }
  } catch { /* DB may not have the table yet */ }
}

if (!twin) {
  // Fallback: create a minimal twin from viz directory
  const vizDir = join(config.vizRoot, 'versions', version);
  if (!existsSync(vizDir)) {
    console.error(`✗ Version ${version} not found (no twin, no viz dir)`);
    process.exit(1);
  }
  twin = {
    version,
    viz_path: `viz/versions/${version}`,
    apply_steps: [
      { type: 'symlink', from: 'viz/active', to: `viz/versions/${version}` },
      { type: 'restart', service: 'viz' },
    ],
    rollback_steps: [],
    requires_rebuild: false,
  };
  console.log(`▸ No version twin found — using minimal fallback (symlink + restart)`);
}

// Check requires_rebuild
if (twin.requires_rebuild && !isRollback) {
  console.error(`✗ Version ${version} requires Docker rebuild (requires_rebuild=true).`);
  console.error(`  Run: docker compose -f docker-compose.test.yml build --no-cache && docker compose -f docker-compose.test.yml up -d`);
  process.exit(1);
}

// Get current version for rollback reference
let previousVersion = null;
try {
  const activeLink = join(config.vizRoot, 'active');
  const target = readlinkSync(activeLink);
  previousVersion = target.replace('versions/', '');
  console.log(`▸ Current version: ${previousVersion}`);
} catch { /* no active symlink */ }

// Execute steps
const steps = isRollback ? twin.rollback_steps : twin.apply_steps;
if (!steps || steps.length === 0) {
  console.error(`✗ No ${isRollback ? 'rollback' : 'apply'} steps defined`);
  process.exit(1);
}

const startTime = Date.now();

for (const step of steps) {
  console.log(`\n▸ Step: ${step.type}...`);

  try {
    switch (step.type) {
      case 'migration': {
        console.log(`  Running migrations against ${config.db}`);
        execFileSync('node', ['-e', `
          process.env.DATABASE_PATH = '${config.db}';
          import('./api/db/migrate.ts');
        `], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, DATABASE_PATH: config.db } });
        // Fallback: direct tsx
        try {
          execFileSync('npx', ['tsx', 'api/db/migrate.ts'], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, DATABASE_PATH: config.db } });
        } catch { /* may already be running from above */ }
        console.log(`  ✓ Migrations applied`);
        break;
      }

      case 'symlink': {
        const linkPath = join(config.vizRoot, step.from || 'active');
        const target = step.to || `versions/${version}`;
        rmSync(linkPath, { force: true });
        symlinkSync(target, linkPath);
        console.log(`  ✓ ${linkPath} → ${target}`);
        break;
      }

      case 'feature_flags': {
        if (step.set && Object.keys(step.set).length > 0) {
          const db = new Database(config.db);
          for (const [flag, enabled] of Object.entries(step.set)) {
            db.prepare('UPDATE feature_flags SET enabled = ? WHERE name = ?').run(enabled ? 1 : 0, flag);
          }
          db.close();
          console.log(`  ✓ Feature flags updated: ${Object.keys(step.set).join(', ')}`);
        } else {
          console.log(`  ○ No flags to set`);
        }
        break;
      }

      case 'restart': {
        console.log(`  Restarting via: ${config.restartCmd}`);
        const [cmd, ...args] = config.restartCmd.split(' ');
        execFileSync(cmd, args, { stdio: 'inherit' });
        console.log(`  ✓ Restart initiated`);

        // Health check
        console.log(`  Waiting for health check...`);
        let healthy = false;
        for (let i = 0; i < 10; i++) {
          try {
            const res = await fetch(config.healthUrl);
            if (res.ok) { healthy = true; break; }
          } catch { /* retry */ }
          await new Promise(r => setTimeout(r, 3000));
        }
        if (healthy) {
          console.log(`  ✓ Health check passed`);
        } else {
          console.error(`  ✗ Health check failed after 30s`);
          if (!isRollback && previousVersion) {
            console.log(`\n  ⚠ Auto-rolling back to ${previousVersion}...`);
            const rollbackLink = join(config.vizRoot, 'active');
            rmSync(rollbackLink, { force: true });
            symlinkSync(`versions/${previousVersion}`, rollbackLink);
            const [rcmd, ...rargs] = config.restartCmd.split(' ');
            execFileSync(rcmd, rargs, { stdio: 'inherit' });
            console.log(`  ✓ Rolled back to ${previousVersion}`);
          }
          process.exit(1);
        }
        break;
      }

      case 'config': {
        console.log(`  ○ Config step (no-op for Tier 1)`);
        break;
      }

      default:
        console.log(`  ? Unknown step type: ${step.type}`);
    }
  } catch (err) {
    console.error(`  ✗ Step failed: ${err.message}`);
    process.exit(1);
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n═══ ${isRollback ? 'Rollback' : 'Deploy'} complete ═══`);
console.log(`Version: ${version} on ${station}`);
console.log(`Time: ${elapsed}s\n`);
