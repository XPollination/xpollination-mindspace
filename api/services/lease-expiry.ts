import { getDb } from '../db/connection.js';
import { sendToAgent } from '../lib/sse-manager.js';

let expiryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Look up the agent_id for a task (via claimed_by on tasks table).
 */
function getAgentForTask(db: any, taskId: string): string | null {
  const task = db.prepare('SELECT claimed_by FROM tasks WHERE id = ?').get(taskId) as any;
  return task?.claimed_by || null;
}

/**
 * Check for expired active leases and unclaim their tasks.
 * Also sends LEASE_WARNING SSE 30min before expiry and LEASE_EXPIRED on expiry.
 */
export function checkExpiredLeases(): number {
  const db = getDb();
  let count = 0;

  // 1. Send LEASE_WARNING for leases expiring within 30 minutes (not yet warned)
  const warningLeases = db.prepare(
    "SELECT * FROM leases WHERE status = 'active' AND expires_at > datetime('now') AND expires_at <= datetime('now', '+30 minutes') AND warning_sent = 0"
  ).all() as Array<{ id: string; task_id: string; user_id: string }>;

  for (const lease of warningLeases) {
    const agentId = getAgentForTask(db, lease.task_id);
    if (agentId) {
      sendToAgent(agentId, 'lease', {
        type: 'LEASE_WARNING',
        lease_id: lease.id,
        task_id: lease.task_id
      });
    }
    db.prepare("UPDATE leases SET warning_sent = 1 WHERE id = ?").run(lease.id);
  }

  // 2. Process expired leases: send LEASE_EXPIRED SSE and unclaim
  const expiredLeases = db.prepare(
    "SELECT * FROM leases WHERE status = 'active' AND expires_at < datetime('now')"
  ).all() as Array<{ id: string; task_id: string }>;

  for (const lease of expiredLeases) {
    const agentId = getAgentForTask(db, lease.task_id);

    const transaction = db.transaction(() => {
      // Set lease status to expired
      db.prepare(
        "UPDATE leases SET status = 'expired' WHERE id = ?"
      ).run(lease.id);

      // Unclaim task: set claimed_by to NULL, return to pool
      db.prepare(
        'UPDATE tasks SET claimed_by = NULL WHERE id = ?'
      ).run(lease.task_id);
    });

    try {
      transaction();
      count++;

      // Send LEASE_EXPIRED SSE after successful expiry
      if (agentId) {
        sendToAgent(agentId, 'lease', {
          type: 'LEASE_EXPIRED',
          lease_id: lease.id,
          task_id: lease.task_id
        });
      }
    } catch {
      // Skip individual failures, continue processing
    }
  }

  return count;
}

/**
 * Start the lease expiry job — runs checkExpiredLeases every 60 seconds.
 */
export function startLeaseExpiryJob(): void {
  if (expiryInterval) return;
  // Run immediately on start, then every 60s
  checkExpiredLeases();
  expiryInterval = setInterval(checkExpiredLeases, 60 * 1000);
}

/**
 * Stop the lease expiry job.
 */
export function stopLeaseExpiryJob(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
}
