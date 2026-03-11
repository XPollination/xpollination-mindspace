import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

/**
 * Check for expired pending approvals and transition their tasks to rework.
 * Queries pending approvals where expires_at < now, sets status='expired',
 * and records a system-initiated transition to rework.
 */
export function checkExpiredApprovals(db: Database.Database): { expired_count: number; expired_ids: string[] } {
  const expired_ids: string[] = [];

  // Find pending approvals past their expiry
  const expiredApprovals = db.prepare(
    `SELECT * FROM approval_requests
     WHERE status = 'pending' AND expires_at < datetime('now')`
  ).all() as any[];

  for (const approval of expiredApprovals) {
    // Set approval status to expired
    db.prepare(
      "UPDATE approval_requests SET status = 'expired' WHERE id = ?"
    ).run(approval.id);

    // Transition the associated task to rework with system actor
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(approval.task_id) as any;
    if (task && task.status !== 'complete' && task.status !== 'cancelled') {
      db.prepare(
        "UPDATE tasks SET status = 'rework', updated_at = datetime('now') WHERE id = ?"
      ).run(approval.task_id);

      // Record the transition
      db.prepare(
        `INSERT INTO task_transitions (id, task_id, project_slug, from_status, to_status, actor, reason)
         VALUES (?, ?, ?, ?, 'rework', 'system', 'Approval expired — automatic rework transition')`
      ).run(randomUUID(), approval.task_id, approval.project_slug, task.status);
    }

    expired_ids.push(approval.id);
  }

  return { expired_count: expired_ids.length, expired_ids };
}
