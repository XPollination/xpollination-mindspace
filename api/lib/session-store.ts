/**
 * Agent Session Store — persistent sessions with JWT renewal
 * Sessions survive reconnects and server restarts via SQLite.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

export interface AgentSession {
  id: string;
  agent_id: string;
  user_id: string;
  project_slug: string;
  role: string;
  permissions: string[];
  token_hash: string;
  status: string;
  connected_at: string;
  last_heartbeat: string;
  disconnected_at: string | null;
  expires_at: string;
  metadata: any;
}

export function createSession(db: any, agentId: string, userId: string, projectSlug: string, role: string, ttlHours = 24): { session_id: string; session_token: string; expires_at: string } {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const sessionToken = jwt.sign(
    { sub: userId, agent_id: agentId, session_id: sessionId, role, project_slug: projectSlug },
    JWT_SECRET,
    { expiresIn: ttlHours * 3600 }
  );
  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  db.prepare(
    `INSERT INTO agent_sessions (id, agent_id, user_id, project_slug, role, token_hash, status, connected_at, last_heartbeat, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'), ?)`
  ).run(sessionId, agentId, userId, projectSlug, role, tokenHash, expiresAt);

  return { session_id: sessionId, session_token: sessionToken, expires_at: expiresAt };
}

export function getSession(db: any, sessionId: string): AgentSession | null {
  const row = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(sessionId) as any;
  if (!row) return null;
  return { ...row, permissions: JSON.parse(row.permissions || '[]'), metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

export function getSessionByToken(db: any, tokenHash: string): AgentSession | null {
  const row = db.prepare('SELECT * FROM agent_sessions WHERE token_hash = ? AND status != ?').get(tokenHash, 'expired') as any;
  if (!row) return null;
  return { ...row, permissions: JSON.parse(row.permissions || '[]'), metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

export function refreshSession(db: any, sessionId: string, ttlHours = 24): boolean {
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const result = db.prepare(
    "UPDATE agent_sessions SET last_heartbeat = datetime('now'), expires_at = ?, status = 'active' WHERE id = ? AND status IN ('active', 'idle')"
  ).run(expiresAt, sessionId);
  return result.changes > 0;
}

export function disconnectSession(db: any, sessionId: string): boolean {
  const result = db.prepare(
    "UPDATE agent_sessions SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ? AND status = 'active'"
  ).run(sessionId);
  return result.changes > 0;
}

export function reconnectSession(db: any, sessionId: string): AgentSession | null {
  const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ? AND status = ?').get(sessionId, 'disconnected') as any;
  if (!session) return null;

  // Check grace period
  const disconnectedAt = new Date(session.disconnected_at).getTime();
  if (Date.now() - disconnectedAt > GRACE_PERIOD_MS) return null; // Grace period expired

  db.prepare(
    "UPDATE agent_sessions SET status = 'active', disconnected_at = NULL, last_heartbeat = datetime('now') WHERE id = ?"
  ).run(sessionId);

  return getSession(db, sessionId);
}

export function expireStale(db: any): string[] {
  // Expire sessions past TTL
  const expired = db.prepare(
    "SELECT id FROM agent_sessions WHERE status IN ('active', 'idle') AND expires_at < datetime('now')"
  ).all() as { id: string }[];

  if (expired.length > 0) {
    db.prepare(
      "UPDATE agent_sessions SET status = 'expired' WHERE status IN ('active', 'idle') AND expires_at < datetime('now')"
    ).run();
  }

  // Expire disconnected sessions past grace period
  const graceExpired = db.prepare(
    "SELECT id FROM agent_sessions WHERE status = 'disconnected' AND disconnected_at < datetime('now', '-5 minutes')"
  ).all() as { id: string }[];

  if (graceExpired.length > 0) {
    db.prepare(
      "UPDATE agent_sessions SET status = 'expired' WHERE status = 'disconnected' AND disconnected_at < datetime('now', '-5 minutes')"
    ).run();
  }

  return [...expired.map(e => e.id), ...graceExpired.map(e => e.id)];
}

export function getActiveByRole(db: any, role: string, projectSlug?: string): AgentSession[] {
  let sql = "SELECT * FROM agent_sessions WHERE role = ? AND status = 'active'";
  const params: any[] = [role];
  if (projectSlug) { sql += ' AND project_slug = ?'; params.push(projectSlug); }
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({ ...row, permissions: JSON.parse(row.permissions || '[]'), metadata: row.metadata ? JSON.parse(row.metadata) : null }));
}
