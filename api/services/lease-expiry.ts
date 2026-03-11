import { getDb } from '../db/connection.js';

let expiryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check for expired active leases and unclaim their tasks.
 * Uses a transaction for safety — each expired lease is processed atomically.
 */
export function checkExpiredLeases(): number {
  const db = getDb();
  let count = 0;

  const expiredLeases = db.prepare(
    "SELECT * FROM leases WHERE status = 'active' AND expires_at < datetime('now')"
  ).all() as Array<{ id: string; task_id: string }>;

  for (const lease of expiredLeases) {
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
