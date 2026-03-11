import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  let apiKey = req.headers['x-api-key'] as string | undefined;
  let fromBearer = false;

  // Also accept API key via Bearer token
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7);
      fromBearer = true;
    }
  }

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
    // If from Bearer, fall through to let JWT auth try (might be a JWT)
    if (fromBearer) {
      next();
      return;
    }
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
