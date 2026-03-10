import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

const AGENT_BOND_DURATION_MINUTES = parseInt(process.env.AGENT_BOND_DURATION_MINUTES || '60', 10);

/**
 * Create a new agent bond (session lease) on registration.
 */
export function createBond(agentId: string, sessionId: string): any {
  const db = getDb();
  const id = randomUUID();

  // Expire any existing active bonds for this agent
  db.prepare("UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE agent_id = ? AND status = 'active'")
    .run(agentId);

  db.prepare(
    `INSERT INTO agent_bonds (id, agent_id, session_id, status, expires_at)
     VALUES (?, ?, ?, 'active', datetime('now', '+' || ? || ' minutes'))`
  ).run(id, agentId, sessionId, AGENT_BOND_DURATION_MINUTES);

  return db.prepare('SELECT * FROM agent_bonds WHERE id = ?').get(id);
}

/**
 * Renew an active bond — extend expires_at, increment renewal_count.
 */
export function renewBond(agentId: string): any {
  const db = getDb();
  const bond = db.prepare("SELECT * FROM agent_bonds WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(agentId) as any;

  if (!bond) return null;

  db.prepare(
    `UPDATE agent_bonds SET renewed_at = datetime('now'), expires_at = datetime('now', '+' || ? || ' minutes'), renewal_count = renewal_count + 1
     WHERE id = ?`
  ).run(AGENT_BOND_DURATION_MINUTES, bond.id);

  return db.prepare('SELECT * FROM agent_bonds WHERE id = ?').get(bond.id);
}

/**
 * Expire a specific bond (e.g., on graceful disconnect).
 */
export function expireBond(bondId: string): any {
  const db = getDb();
  db.prepare("UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE id = ?")
    .run(bondId);
  return db.prepare('SELECT * FROM agent_bonds WHERE id = ?').get(bondId);
}

/**
 * Get the active bond for an agent, if any.
 */
export function getActiveBond(agentId: string): any {
  const db = getDb();
  return db.prepare("SELECT * FROM agent_bonds WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(agentId);
}

/**
 * Sweep: expire all bonds past their expires_at timestamp.
 */
export function sweepExpiredBonds(): number {
  const db = getDb();
  const result = db.prepare(
    "UPDATE agent_bonds SET status = 'expired', expired_at = datetime('now') WHERE status = 'active' AND expires_at < datetime('now')"
  ).run();
  return result.changes;
}
