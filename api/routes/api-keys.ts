/**
 * API Key management routes — store/list/revoke provider API keys
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { encrypt, decrypt } from '../lib/key-encryption.js';

export const apiKeysRouter = Router();

const VALID_PROVIDERS = ['anthropic', 'openai', 'custom'];

// POST / — store a new API key (encrypted)
apiKeysRouter.post('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }
  const { provider, key, name } = req.body;
  if (!provider || !VALID_PROVIDERS.includes(provider)) { res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` }); return; }
  if (!key) { res.status(400).json({ error: 'key is required' }); return; }

  const db = getDb();
  const id = randomUUID();
  const encrypted = encrypt(key);
  db.prepare('INSERT INTO user_api_keys (id, user_id, provider, encrypted_key, key_name) VALUES (?, ?, ?, ?, ?)')
    .run(id, user.id || user.user_id, provider, encrypted, name || null);

  res.status(201).json({ id, provider, key_name: name, key_hint: `...${key.slice(-4)}`, created_at: new Date().toISOString() });
});

// GET / — list keys (never returns decrypted key)
apiKeysRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }
  const db = getDb();
  const keys = db.prepare("SELECT id, provider, key_name, created_at, last_used_at, status FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id || user.user_id);
  res.status(200).json(keys);
});

// DELETE /:id — revoke a key
apiKeysRouter.delete('/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }
  const db = getDb();
  const result = db.prepare("UPDATE user_api_keys SET status = 'revoked' WHERE id = ? AND user_id = ?")
    .run(req.params.id, user.id || user.user_id);
  if (result.changes === 0) { res.status(404).json({ error: 'Key not found' }); return; }
  res.status(200).json({ id: req.params.id, status: 'revoked' });
});

// Internal: decrypt key for turn engine (not exposed to frontend routes)
export function getDecryptedKey(db: any, userId: string, provider: string): string | null {
  const row = db.prepare("SELECT encrypted_key FROM user_api_keys WHERE user_id = ? AND provider = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(userId, provider) as any;
  if (!row) return null;
  db.prepare("UPDATE user_api_keys SET last_used_at = datetime('now') WHERE user_id = ? AND provider = ? AND status = 'active'")
    .run(userId, provider);
  return decrypt(row.encrypted_key);
}
