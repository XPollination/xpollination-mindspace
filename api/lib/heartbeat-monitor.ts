/**
 * Heartbeat Monitor — server-side agent health checks with auto-recovery
 * Replaces xpo.claude.unblock skill and manual pgrep/kill.
 */

import { broadcast, sendToAgent } from './sse-manager.js';
import { expireAndRequeue } from './lease-manager.js';
import { expireStale, disconnectSession } from './session-store.js';
import { onCrash, getProcess, stop as stopProcess } from './process-manager.js';
import { EVENT_TYPES, buildLeaseWarning, buildLeaseExpired } from './event-types.js';
import { getDb } from '../db/connection.js';

const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT || '90', 10); // seconds
const DISCONNECT_TIMEOUT = parseInt(process.env.DISCONNECT_TIMEOUT || '180', 10);
const CHECK_INTERVAL = 30_000; // 30 seconds

let monitorInterval: NodeJS.Timeout | null = null;

interface AgentHealth {
  agent_id: string;
  role: string;
  status: string;
  last_heartbeat: string;
  heartbeat_age_s: number;
  lease_count: number;
  health: 'green' | 'yellow' | 'red';
}

function checkAgents(): void {
  const db = getDb();
  const now = Date.now();

  // 1. Scan active sessions
  const sessions = db.prepare(
    "SELECT id, agent_id, role, last_heartbeat, status FROM agent_sessions WHERE status IN ('active', 'idle')"
  ).all() as any[];

  for (const session of sessions) {
    const lastBeat = new Date(session.last_heartbeat).getTime();
    const ageSeconds = Math.floor((now - lastBeat) / 1000);

    // Warning: approaching timeout
    if (ageSeconds > HEARTBEAT_TIMEOUT && ageSeconds <= DISCONNECT_TIMEOUT) {
      // Send warning to agent
      const leases = db.prepare("SELECT task_id FROM leases WHERE session_id = ? AND status = 'active'").all(session.id) as any[];
      for (const lease of leases) {
        const task = db.prepare('SELECT slug FROM tasks WHERE id = ?').get(lease.task_id) as any;
        if (task) {
          sendToAgent(session.agent_id, EVENT_TYPES.LEASE_WARNING, buildLeaseWarning(task.slug, DISCONNECT_TIMEOUT - ageSeconds));
        }
      }
    }

    // Disconnect: heartbeat timed out
    if (ageSeconds > DISCONNECT_TIMEOUT && session.status === 'active') {
      disconnectSession(db, session.id);

      // Check if process is unresponsive and restart
      const proc = getProcess(session.agent_id);
      if (proc && proc.status === 'running') {
        stopProcess(session.agent_id);
        onCrash(session.agent_id, 'Heartbeat timeout');
      }
    }
  }

  // 2. Expire stale sessions (past grace period)
  expireStale(db);

  // 3. Expire stale leases and re-queue tasks
  const requeued = expireAndRequeue(db);
  for (const { slug, role } of requeued) {
    broadcast(EVENT_TYPES.LEASE_EXPIRED, buildLeaseExpired(slug, 'expired'));
  }
}

export function startMonitor(): void {
  if (monitorInterval) return; // Already running
  monitorInterval = setInterval(checkAgents, CHECK_INTERVAL);
  // Run immediately on start
  try { checkAgents(); } catch { /* ignore startup errors */ }
}

export function stopMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export function getHealthReport(): AgentHealth[] {
  const db = getDb();
  const now = Date.now();
  const sessions = db.prepare(
    "SELECT id, agent_id, role, last_heartbeat, status FROM agent_sessions WHERE status IN ('active', 'idle', 'disconnected')"
  ).all() as any[];

  return sessions.map((s: any) => {
    const ageSeconds = Math.floor((now - new Date(s.last_heartbeat).getTime()) / 1000);
    const { count: leaseCount } = db.prepare("SELECT COUNT(*) as count FROM leases WHERE session_id = ? AND status = 'active'").get(s.id) as { count: number };

    let health: 'green' | 'yellow' | 'red' = 'green';
    if (ageSeconds > DISCONNECT_TIMEOUT || s.status === 'disconnected') health = 'red';
    else if (ageSeconds > HEARTBEAT_TIMEOUT) health = 'yellow';

    return {
      agent_id: s.agent_id,
      role: s.role,
      status: s.status,
      last_heartbeat: s.last_heartbeat,
      heartbeat_age_s: ageSeconds,
      lease_count: leaseCount,
      health,
    };
  });
}
