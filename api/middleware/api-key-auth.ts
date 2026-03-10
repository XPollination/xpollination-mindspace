import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    next();
    return;
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const db = getDb();
  const row = db.prepare(
    `SELECT ak.id AS key_id, ak.revoked_at, u.id, u.email, u.name
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ?`
  ).get(keyHash) as any;

  if (!row) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  if (row.revoked_at) {
    res.status(401).json({ error: 'API key has been revoked' });
    return;
  }

  // Set req.user with authenticated user data
  (req as any).user = { id: row.id, email: row.email, name: row.name };
  next();
}
