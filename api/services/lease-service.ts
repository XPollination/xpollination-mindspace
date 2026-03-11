import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

// Role-based lease durations in hours
const ROLE_DURATIONS: Record<string, number> = {
  pdsa: 4,     // PDSA gets 4 hour lease
  dev: 6,      // DEV gets 6 hour lease
  qa: 3,       // QA gets 3 hour lease
  liaison: 2,  // LIAISON gets 2 hour lease
};

/**
 * Create a lease for a claimed task with role-based duration.
 */
export function createLease(
  db: Database.Database,
  taskId: string,
  userId: string,
  role: string
): any {
  const hours = ROLE_DURATIONS[role.toLowerCase()] || 4; // default 4h
  const id = randomUUID();

  db.prepare(
    `INSERT INTO leases (id, task_id, user_id, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${hours} hours'))`
  ).run(id, taskId, userId);

  return db.prepare('SELECT * FROM leases WHERE id = ?').get(id);
}

/**
 * Renew a lease by resetting expires_at to now + given hours.
 */
export function renewLease(
  db: Database.Database,
  leaseId: string,
  hours: number = 4
): any {
  db.prepare(
    `UPDATE leases SET expires_at = datetime('now', '+${hours} hours'), warning_sent = 0 WHERE id = ?`
  ).run(leaseId);

  return db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId);
}
