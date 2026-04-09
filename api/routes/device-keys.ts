/**
 * Device Keys — Ed25519 persistent authentication for agent sessions.
 *
 * Hierarchy: 1 User → N Device Keys (per machine) → M Agent Connections per key.
 * Keys have no expiry — sessions live until explicitly revoked.
 *
 * See: docs/missions/mission-agent-oauth-sessions.md v2.1
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { disconnectByDeviceKey } from '../lib/sse-manager.js';

export const deviceKeysRouter = Router();

/**
 * POST /register — Register a new Ed25519 device key.
 * Called once per machine after initial device flow approval.
 * Requires JWT auth (bootstrap token from device flow).
 */
deviceKeysRouter.post('/register', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { public_key, name } = req.body || {};
  if (!public_key || !name) {
    res.status(400).json({ error: 'public_key (PEM) and name are required' });
    return;
  }

  // Validate it's a real Ed25519 public key
  try {
    const keyObj = crypto.createPublicKey(public_key);
    if (keyObj.asymmetricKeyType !== 'ed25519') {
      res.status(400).json({ error: 'Key must be Ed25519' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid public key PEM' });
    return;
  }

  const db = getDb();
  const publicKeyHash = crypto.createHash('sha256').update(public_key).digest('hex');

  // Check for duplicate
  const existing = db.prepare('SELECT id FROM device_keys WHERE public_key_hash = ?').get(publicKeyHash) as any;
  if (existing) {
    res.status(409).json({ error: 'Key already registered', key_id: existing.id });
    return;
  }

  const keyId = 'dk_' + crypto.randomBytes(12).toString('hex');

  db.prepare(
    'INSERT INTO device_keys (id, user_id, name, public_key_pem, public_key_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(keyId, user.id, name, public_key, publicKeyHash);

  res.status(201).json({
    key_id: keyId,
    name,
    user: user.email || user.name,
    registered: new Date().toISOString(),
  });
});

/**
 * GET / — List user's device keys with nested active agent connections.
 */
deviceKeysRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();
  const keys = db.prepare(
    'SELECT id, name, created_at, last_active, revoked_at FROM device_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).all(user.id) as any[];

  const includeDisconnected = req.query.include_disconnected === 'true';

  for (const key of keys) {
    const where = includeDisconnected
      ? 'WHERE device_key_id = ?'
      : 'WHERE device_key_id = ? AND disconnected_at IS NULL';
    key.connections = db.prepare(
      `SELECT id, agent_name, session_name, role, project_slug, connected_at, last_heartbeat, disconnected_at FROM agent_connections ${where} ORDER BY connected_at DESC`
    ).all(key.id);
  }

  res.json(keys);
});

/**
 * PATCH /:id — Revoke a device key.
 * Marks key as revoked and disconnects all active agent connections.
 */
deviceKeysRouter.patch('/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const db = getDb();

  const key = db.prepare('SELECT id, user_id, revoked_at FROM device_keys WHERE id = ?').get(id) as any;
  if (!key) {
    res.status(404).json({ error: 'Device key not found' });
    return;
  }
  if (key.user_id !== user.id) {
    res.status(403).json({ error: 'Not your device key' });
    return;
  }
  if (key.revoked_at) {
    res.status(400).json({ error: 'Already revoked' });
    return;
  }

  db.prepare("UPDATE device_keys SET revoked_at = datetime('now') WHERE id = ?").run(id);

  const disconnected = db.prepare(
    "UPDATE agent_connections SET disconnected_at = datetime('now') WHERE device_key_id = ? AND disconnected_at IS NULL"
  ).run(id);

  // Actively disconnect SSE streams for this key
  const sseDisconnected = disconnectByDeviceKey(id);

  res.json({ id, revoked: true, connections_closed: disconnected.changes, sse_disconnected: sseDisconnected });
});

/**
 * DELETE /revoke-all — Revoke all device keys for the authenticated user.
 */
deviceKeysRouter.delete('/revoke-all', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();

  const keyIds = db.prepare(
    "SELECT id FROM device_keys WHERE user_id = ? AND revoked_at IS NULL"
  ).all(user.id) as any[];

  let totalKeys = 0;
  let totalConns = 0;

  let totalSse = 0;
  for (const key of keyIds) {
    db.prepare("UPDATE device_keys SET revoked_at = datetime('now') WHERE id = ?").run(key.id);
    const r = db.prepare(
      "UPDATE agent_connections SET disconnected_at = datetime('now') WHERE device_key_id = ? AND disconnected_at IS NULL"
    ).run(key.id);
    totalKeys++;
    totalConns += r.changes;
    totalSse += disconnectByDeviceKey(key.id);
  }

  res.json({ keys_revoked: totalKeys, connections_closed: totalConns, sse_disconnected: totalSse });
});
