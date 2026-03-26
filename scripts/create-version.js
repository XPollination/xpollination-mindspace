#!/usr/bin/env node
/**
 * Version Twin Creator — auto-generates version twin from git state
 * Usage: node scripts/create-version.js <version> [--db <path>]
 *
 * Scans git diff from previous version, detects new migrations + viz changes,
 * generates version twin JSON, writes to versions dir + DB.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, readlinkSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const [,, version, ...flags] = process.argv;
const dbFlag = flags.indexOf('--db');
const dbPath = dbFlag >= 0 ? flags[dbFlag + 1] : null;

if (!version) {
  console.error('Usage: node scripts/create-version.js <version> [--db <path>]');
  process.exit(1);
}

console.log(`\n═══ Version Twin Creator ═══`);
console.log(`Version: ${version}\n`);

// 1. Detect previous version from viz/active symlink
let previousVersion = null;
try {
  const target = readlinkSync(join(ROOT, 'viz', 'active'));
  previousVersion = target.replace('versions/', '');
  console.log(`▸ Previous version: ${previousVersion}`);
} catch {
  console.log(`▸ No previous version detected`);
}

// 2. Check if viz directory exists
const vizDir = join(ROOT, 'viz', 'versions', version);
const vizExists = existsSync(vizDir);
console.log(`▸ Viz directory: ${vizExists ? 'exists' : 'MISSING — will need version-bump.sh first'}`);

// 3. Scan migrations — find new ones since previous version
const migrationsDir = join(ROOT, 'api', 'db', 'migrations');
const allMigrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
console.log(`▸ Total migrations: ${allMigrations.length}`);

// Detect new migrations by checking git diff
let newMigrations = [];
try {
  if (previousVersion) {
    const diff = execFileSync('git', ['diff', '--name-only', `${previousVersion}..HEAD`, '--', 'api/db/migrations/'], { cwd: ROOT, encoding: 'utf8' }).trim();
    newMigrations = diff ? diff.split('\n').map(f => f.replace('api/db/migrations/', '')) : [];
  } else {
    newMigrations = allMigrations;
  }
} catch {
  // If git tag doesn't exist, detect by number range
  const prevNum = previousVersion ? parseInt(previousVersion.replace(/\D/g, '')) : 0;
  newMigrations = allMigrations.filter(f => {
    const num = parseInt(f.split('-')[0]);
    return num > 72; // After Agent OS base (rough heuristic)
  });
}
console.log(`▸ New migrations: ${newMigrations.length > 0 ? newMigrations.join(', ') : 'none'}`);

// 4. Check for new npm dependencies (requires_rebuild)
let requiresRebuild = false;
try {
  if (previousVersion) {
    const diff = execFileSync('git', ['diff', `${previousVersion}..HEAD`, '--', 'package.json'], { cwd: ROOT, encoding: 'utf8' });
    if (diff.includes('"dependencies"') || diff.includes('"devDependencies"')) {
      requiresRebuild = true;
    }
  }
} catch { /* ignore */ }
console.log(`▸ Requires rebuild: ${requiresRebuild}`);

// 5. Get commits since previous version
let commits = [];
try {
  if (previousVersion) {
    const log = execFileSync('git', ['log', '--oneline', `${previousVersion}..HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim();
    commits = log ? log.split('\n').map(l => l.split(' ')[0]) : [];
  } else {
    const log = execFileSync('git', ['log', '--oneline', '-20'], { cwd: ROOT, encoding: 'utf8' }).trim();
    commits = log ? log.split('\n').map(l => l.split(' ')[0]) : [];
  }
} catch { /* ignore */ }
console.log(`▸ Commits: ${commits.length}`);

// 6. Read changelog if exists
let changelog = '';
const changelogPath = join(vizDir, 'changelog.json');
if (existsSync(changelogPath)) {
  const cj = JSON.parse(readFileSync(changelogPath, 'utf8'));
  changelog = `${cj.title}: ${(cj.changes || []).join(', ')}`;
}

// 7. Build version twin
const twin = {
  _type: 'version',
  _schema_version: '1.0.0',
  _created_at: new Date().toISOString(),
  id: randomUUID(),
  version,
  parent_version: previousVersion,
  viz_path: `viz/versions/${version}`,
  migrations: newMigrations,
  feature_flags: {},
  config_defaults: {},
  requires_rebuild: requiresRebuild,
  apply_steps: [
    ...(newMigrations.length > 0 ? [{ type: 'migration', files: newMigrations }] : []),
    { type: 'symlink', from: 'active', to: `versions/${version}` },
    { type: 'restart', service: 'viz' },
  ],
  rollback_steps: previousVersion ? [
    { type: 'symlink', from: 'active', to: `versions/${previousVersion}` },
    { type: 'restart', service: 'viz' },
  ] : [],
  changelog,
  commits,
  decision_refs: [],
  status: 'draft',
};

// 8. Write to file
if (!existsSync(vizDir)) mkdirSync(vizDir, { recursive: true });
const twinPath = join(vizDir, 'version-twin.json');
writeFileSync(twinPath, JSON.stringify(twin, null, 2));
console.log(`\n✓ Written: ${twinPath}`);

// 9. Insert into DB if path provided
if (dbPath) {
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    db.prepare(`INSERT OR REPLACE INTO version_twins (id, version, parent_version, viz_path, migrations_json, feature_flags_json, config_defaults_json, apply_steps_json, rollback_steps_json, requires_rebuild, changelog, commits_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(twin.id, twin.version, twin.parent_version, twin.viz_path, JSON.stringify(twin.migrations), JSON.stringify(twin.feature_flags), JSON.stringify(twin.config_defaults), JSON.stringify(twin.apply_steps), JSON.stringify(twin.rollback_steps), twin.requires_rebuild ? 1 : 0, twin.changelog, JSON.stringify(twin.commits), twin.status, twin._created_at);
    db.close();
    console.log(`✓ Inserted into DB: ${dbPath}`);
  } catch (err) {
    console.log(`⚠ DB insert failed (table may not exist yet): ${err.message}`);
  }
}

console.log(`\n═══ Version twin created: ${version} ═══\n`);
