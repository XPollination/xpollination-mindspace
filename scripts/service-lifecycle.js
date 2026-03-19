#!/usr/bin/env node
/**
 * Service Lifecycle Manager
 * Encapsulates all infrastructure knowledge for agent-friendly operations.
 *
 * Usage:
 *   node scripts/service-lifecycle.js restart viz
 *   node scripts/service-lifecycle.js restart api
 *   node scripts/service-lifecycle.js deploy viz v0.0.36
 *   node scripts/service-lifecycle.js migrate
 *   node scripts/service-lifecycle.js health
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Load .env if available
try {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
} catch (e) { /* .env not required */ }

// Service definitions
const SERVICES = {
  viz: {
    name: 'Viz Server',
    port: 4200,
    command: 'node',
    args: ['viz/server.js'],
    cwd: ROOT,
    healthUrl: 'http://localhost:4200/api/health',
    envVars: ['VIZ_PORT', 'VIZ_BIND'],
  },
  api: {
    name: 'API Server',
    port: 3100,
    command: 'npx',
    args: ['tsx', 'api/server.ts'],
    cwd: ROOT,
    healthUrl: 'http://localhost:3100/api/health',
    envVars: ['JWT_SECRET', 'DATABASE_PATH', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
};

function killByPort(port) {
  try {
    const output = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (output) {
      const pids = output.split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          console.log(`  Killed PID ${pid} on port ${port}`);
        } catch (e) { /* already dead */ }
      }
    }
  } catch (e) { /* no process on port */ }
}

async function checkHealth(url, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data };
      }
    } catch (e) { /* not ready yet */ }
    await new Promise(r => setTimeout(r, delay));
  }
  return { ok: false };
}

async function restart(serviceName) {
  const service = SERVICES[serviceName];
  if (!service) {
    console.error(`Unknown service: ${serviceName}. Available: ${Object.keys(SERVICES).join(', ')}`);
    process.exit(1);
  }

  console.log(`Restarting ${service.name} (port ${service.port})...`);
  killByPort(service.port);
  await new Promise(r => setTimeout(r, 1000));

  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env },
  });
  child.unref();
  console.log(`  Started ${service.name} (PID ${child.pid})`);

  const healthCheck = await checkHealth(service.healthUrl);
  if (healthCheck.ok) {
    console.log(`  Health: OK`);
  } else {
    console.error(`  Health: FAILED — service may not have started correctly`);
  }
}

async function deploy(serviceName, version) {
  if (serviceName !== 'viz') {
    console.error('Deploy only supported for viz (versioned UI)');
    process.exit(1);
  }

  const versionsDir = path.join(ROOT, 'viz', 'versions');
  const activeLink = path.join(ROOT, 'viz', 'active');
  const newVersionDir = path.join(versionsDir, version);

  // Save previous version for rollback
  let previousVersion = null;
  try {
    previousVersion = fs.readlinkSync(activeLink);
  } catch (e) { /* no symlink */ }

  console.log(`Deploying viz ${version}...`);

  if (!fs.existsSync(newVersionDir)) {
    console.error(`  Version directory not found: ${newVersionDir}`);
    process.exit(1);
  }

  // Update symlink
  fs.rmSync(activeLink, { force: true });
  fs.symlinkSync(`versions/${version}`, activeLink);
  console.log(`  Symlink updated: active → versions/${version}`);

  // Restart and check health
  await restart('viz');

  const health = await checkHealth(SERVICES.viz.healthUrl);
  if (!health.ok && previousVersion) {
    console.error(`  Rollback: reverting to ${previousVersion}`);
    fs.rmSync(activeLink, { force: true });
    fs.symlinkSync(previousVersion, activeLink);
    await restart('viz');
  }
}

async function healthCheckAll() {
  console.log('Service Health Check\n');
  for (const [name, service] of Object.entries(SERVICES)) {
    const result = await checkHealth(service.healthUrl, 1, 1000);
    const status = result.ok ? 'OK' : 'DOWN';
    const icon = result.ok ? '+' : '-';
    console.log(`  [${icon}] ${service.name} (port ${service.port}): ${status}`);
  }
}

// Command router
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'restart':
    restart(args[0]).catch(console.error);
    break;
  case 'deploy':
    deploy(args[0], args[1]).catch(console.error);
    break;
  case 'health':
    healthCheckAll().catch(console.error);
    break;
  default:
    console.log('Usage: node scripts/service-lifecycle.js <command> [args]');
    console.log('Commands: restart <service>, deploy viz <version>, health');
    console.log('Services: viz, api');
}
