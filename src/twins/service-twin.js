/**
 * ServiceTwin — Self-aware service lifecycle management
 * Each service knows its version, status, PID, and how to restart/evolve.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Create a ServiceTwin from a manifest
 */
export function createServiceTwin(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const now = new Date().toISOString();
  return {
    _type: 'service',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    name: manifest.name,
    version: manifest.version,
    entry: manifest.entry,
    port: manifest.port,
    status: 'stopped',
    pid: null,
    process: null,
    manifest,
  };
}

/**
 * Start the service and track PID + status
 */
export function startService(twin) {
  const child = spawn('node', [twin.entry], {
    env: { ...process.env, ...twin.manifest.environment },
    stdio: 'pipe',
    detached: false,
  });
  twin.pid = child.pid;
  twin.status = 'running';
  twin.process = child;
  return twin;
}

/**
 * EVOLVE handler — dual-process handoff with health check rollback
 * 1. Start new version on temp port
 * 2. Health check for 30s timeout
 * 3. If healthy: graceful drain old, swap
 * 4. If unhealthy: rollback — kill new, keep old
 */
export async function evolve(twin, newManifestPath) {
  const newTwin = createServiceTwin(newManifestPath);
  const tempPort = twin.port + 1;

  // Start new process on temp port
  const newChild = spawn('node', [newTwin.entry], {
    env: { ...process.env, ...newTwin.manifest.environment, PORT: String(tempPort) },
    stdio: 'pipe',
    detached: false,
  });
  newTwin.pid = newChild.pid;
  newTwin.status = 'starting';
  newTwin.process = newChild;

  // Health check with 30s timeout
  const healthTimeout = newTwin.manifest.health_timeout_ms || 30000;
  const healthy = await healthCheck(`http://localhost:${tempPort}${newTwin.manifest.health_endpoint}`, healthTimeout);

  if (!healthy) {
    // Rollback: kill new process, keep old running
    newChild.kill('SIGTERM');
    newTwin.status = 'rollback';
    console.error(`EVOLVE rollback: ${newTwin.name} health check failed after ${healthTimeout}ms`);
    return { success: false, action: 'rollback', twin };
  }

  // Graceful drain old process
  await gracefulDrain(twin);

  // Swap
  twin.status = 'stopped';
  newTwin.status = 'running';
  return { success: true, action: 'handoff', twin: newTwin };
}

/**
 * Health check — polls endpoint until success or timeout
 */
async function healthCheck(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Graceful drain — stop accepting connections, wait for in-flight to complete, then shutdown
 */
async function gracefulDrain(twin) {
  const drainMs = twin.manifest.graceful_drain_ms || 5000;
  twin.status = 'draining';

  // Signal the process to stop accepting new connections
  if (twin.process) {
    twin.process.kill('SIGTERM');
  }

  // Wait for drain period
  await new Promise(r => setTimeout(r, drainMs));

  // Force kill if still running
  if (twin.process && !twin.process.killed) {
    twin.process.kill('SIGKILL');
  }

  twin.status = 'stopped';
  twin.pid = null;
}

export { gracefulDrain };
