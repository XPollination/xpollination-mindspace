import { Router, Request, Response } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const keysRouter = Router();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// POST / - Generate a new API key
keysRouter.post('/', (req: Request, res: Response) => {
  const { user_id, name } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required field: user_id' });
    return;
  }

  const rawKey = 'xpo_' + randomBytes(30).toString('hex');
  const key_hash = hashKey(rawKey);
  const id = randomUUID();

  const db = getDb();
  db.prepare('INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)').run(id, user_id, key_hash, name || null);

  res.status(201).json({ id, key: rawKey, name: name || null });
});

// GET / - List user's API keys
keysRouter.get('/', (req: Request, res: Response) => {
  const { user_id } = req.query;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required query param: user_id' });
    return;
  }

  const db = getDb();
  const keys = db.prepare('SELECT id, user_id, name, created_at, revoked_at FROM api_keys WHERE user_id = ?').all(user_id);

  res.status(200).json(keys);
});

// DELETE /:id - Soft-revoke an API key
keysRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const db = getDb();
  const result = db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL").run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Key not found or already revoked' });
    return;
  }

  res.status(200).json({ id, revoked: true });
});
