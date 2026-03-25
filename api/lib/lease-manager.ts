/**
 * Lease Manager — task claim leases with TTL, heartbeat extension, expiry
 */

import crypto from 'node:crypto';

export function grantLease(db: any, taskId: string, userId: string, ttlMinutes = 30): any {
  // Release any existing active lease for this task
  db.prepare("UPDATE leases SET status = 'released', last_heartbeat = datetime('now') WHERE task_id = ? AND status = 'active'")
    .run(taskId);

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO leases (id, task_id, user_id, started_at, expires_at, last_heartbeat, status) VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), 'active')"
  ).run(id, taskId, userId, expiresAt);

  return { id, task_id: taskId, user_id: userId, expires_at: expiresAt, status: 'active' };
}

export function extendLease(db: any, taskId: string, userId: string, ttlMinutes = 30): boolean {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const result = db.prepare(
    "UPDATE leases SET expires_at = ?, last_heartbeat = datetime('now') WHERE task_id = ? AND user_id = ? AND status = 'active'"
  ).run(expiresAt, taskId, userId);
  return result.changes > 0;
}

export function releaseLease(db: any, taskId: string, userId: string): boolean {
  const result = db.prepare(
    "UPDATE leases SET status = 'released', last_heartbeat = datetime('now') WHERE task_id = ? AND user_id = ? AND status = 'active'"
  ).run(taskId, userId);
  return result.changes > 0;
}

export function expireStaleLeases(db: any): { task_id: string; user_id: string }[] {
  const stale = db.prepare(
    "SELECT task_id, user_id FROM leases WHERE status = 'active' AND expires_at < datetime('now')"
  ).all() as { task_id: string; user_id: string }[];

  if (stale.length > 0) {
    db.prepare(
      "UPDATE leases SET status = 'expired' WHERE status = 'active' AND expires_at < datetime('now')"
    ).run();
  }

  return stale;
}

export function getActiveLease(db: any, taskId: string): any | null {
  return db.prepare(
    "SELECT * FROM leases WHERE task_id = ? AND status = 'active'"
  ).get(taskId) || null;
}
