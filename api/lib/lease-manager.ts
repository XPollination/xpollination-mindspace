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

// Session-bound lease functions
export function grantLeaseForSession(db: any, taskId: string, sessionId: string, userId: string, ttlMinutes = 30): any {
  db.prepare("UPDATE leases SET status = 'released', last_heartbeat = datetime('now') WHERE task_id = ? AND status = 'active'")
    .run(taskId);

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO leases (id, task_id, user_id, session_id, started_at, expires_at, last_heartbeat, status) VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'), 'active')"
  ).run(id, taskId, userId, sessionId, expiresAt);

  return { id, task_id: taskId, session_id: sessionId, expires_at: expiresAt, status: 'active' };
}

export function onSessionDisconnect(db: any, sessionId: string): { task_id: string }[] {
  // Find active leases for this session — they enter grace period (handled by expiry timer)
  return db.prepare(
    "SELECT task_id FROM leases WHERE session_id = ? AND status = 'active'"
  ).all(sessionId) as { task_id: string }[];
}

export function onSessionReconnect(db: any, sessionId: string, ttlMinutes = 30): number {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const result = db.prepare(
    "UPDATE leases SET expires_at = ?, last_heartbeat = datetime('now') WHERE session_id = ? AND status = 'active'"
  ).run(expiresAt, sessionId);
  return result.changes;
}

export function expireAndRequeue(db: any): { task_id: string; slug: string; role: string }[] {
  const stale = db.prepare(
    "SELECT l.task_id, t.slug, t.current_role as role FROM leases l JOIN tasks t ON l.task_id = t.id WHERE l.status = 'active' AND l.expires_at < datetime('now')"
  ).all() as { task_id: string; slug: string; role: string }[];

  for (const { task_id, role } of stale) {
    db.prepare("UPDATE leases SET status = 'expired' WHERE task_id = ? AND status = 'active'").run(task_id);
    db.prepare("UPDATE tasks SET status = 'ready', current_role = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'").run(role, task_id);
  }

  return stale;
}
