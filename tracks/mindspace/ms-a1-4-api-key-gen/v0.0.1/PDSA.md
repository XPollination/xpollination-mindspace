# PDSA: API key generation endpoint

**Task:** ms-a1-4-api-key-gen
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Users need programmatic access to the API (agents, CI/CD, external tools). JWT tokens expire and require login credentials. API keys provide persistent, revocable authentication without sharing passwords.

## Requirements (REQ-AUTH-002)

> Migration: api_keys table (id, user_id, key_hash, name, created_at, revoked_at). POST /api/keys generates key (show once), stores hash. DELETE /api/keys/:id revokes. GET /api/keys lists user's keys. AC: Can generate, list, revoke API keys.

## Investigation

### Existing infrastructure

- **Auth module:** `api/routes/auth.ts` — registration endpoint, bcryptjs for password hashing
- **Database:** better-sqlite3, WAL mode, users table exists (from ms-a1-1)
- **Migration system:** SQL files in `api/db/migrations/`, numeric prefix sort
- **Current migrations:** `001-users.sql` (from ms-a1-1)

### Design decisions

1. **crypto.randomBytes(32) for key generation** — 256-bit random key, encoded as hex (64 chars). Node.js built-in, no external dependency needed. Format: `xpo_` prefix + 60 hex chars (total 64 chars). Prefix makes keys easily identifiable.
2. **SHA-256 hash for storage** — fast, deterministic, no salt needed (unlike passwords). API keys are high-entropy random values, not user-chosen passwords, so bcrypt's slow hashing is unnecessary. SHA-256 via Node.js `crypto.createHash`.
3. **Key shown once on creation** — POST response includes plaintext key. After that, only the hash is stored. User must save the key immediately.
4. **Soft-delete via revoked_at** — DELETE sets `revoked_at` timestamp instead of removing the row. Preserves audit trail. Revoked keys fail authentication.
5. **Separate routes file** — `api/routes/keys.ts` mounted at `/api/keys`. Keeps auth (login/register) and key management separate.
6. **No auth middleware yet** — these endpoints will need JWT auth (ms-a1-3), but we build the routes first. Auth middleware will wrap them later.

## Design

### File 1: `api/db/migrations/004-api-keys.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### File 2: `api/routes/keys.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const keysRouter = Router();

const KEY_PREFIX = 'xpo_';
const KEY_BYTES = 30; // 30 bytes = 60 hex chars + 4 char prefix = 64 total

function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(KEY_BYTES).toString('hex');
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// POST /api/keys — generate a new API key
keysRouter.post('/', (req: Request, res: Response) => {
  const { user_id, name } = req.body;

  if (!user_id || !name) {
    res.status(400).json({ error: 'Missing required fields: user_id, name' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const id = randomUUID();
  const key = generateApiKey();
  const key_hash = hashKey(key);

  db.prepare('INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)').run(id, user_id, key_hash, name);

  res.status(201).json({ id, key, name, created_at: new Date().toISOString() });
});

// GET /api/keys?user_id=... — list user's API keys
keysRouter.get('/', (req: Request, res: Response) => {
  const { user_id } = req.query;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required query: user_id' });
    return;
  }

  const db = getDb();
  const keys = db.prepare(
    'SELECT id, name, created_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).all(user_id);

  res.json({ keys });
});

// DELETE /api/keys/:id — revoke an API key (soft delete)
keysRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const db = getDb();
  const key = db.prepare('SELECT id, revoked_at FROM api_keys WHERE id = ?').get(id) as { id: string; revoked_at: string | null } | undefined;

  if (!key) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  if (key.revoked_at) {
    res.status(409).json({ error: 'API key already revoked' });
    return;
  }

  db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(id);

  res.json({ id, revoked: true });
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount:
```typescript
import { keysRouter } from './routes/keys.js';
// ...
app.use('/api/keys', keysRouter);
```

### Design notes

- **No key_hash in GET response** — only id, name, created_at, revoked_at returned. Hash is internal.
- **No plaintext key stored** — only shown once in POST response. Lost keys must be regenerated.
- **409 on double-revoke** — idempotent-ish, but tells the caller the key was already revoked.
- **user_id passed in body/query** — until JWT middleware (ms-a1-3) extracts it from the token, the caller must provide user_id explicitly. This will be refactored when auth middleware is added.
- **ON DELETE CASCADE** — deleting a user removes all their API keys.

## Files Changed

1. `api/db/migrations/004-api-keys.sql` — api_keys table with key_hash, user_id FK (NEW)
2. `api/routes/keys.ts` — POST/GET/DELETE endpoints for API key management (NEW)
3. `api/server.ts` — mount keysRouter at `/api/keys` (UPDATE)

## Testing

1. Migration file `004-api-keys.sql` exists
2. Creates `api_keys` table with columns: id, user_id, key_hash, name, created_at, revoked_at
3. Foreign key from user_id to users(id) with CASCADE
4. Index on user_id and key_hash
5. POST `/api/keys` with user_id + name returns 201 with id, key, name, created_at
6. Generated key starts with `xpo_` prefix
7. Generated key is 64 characters total (4 prefix + 60 hex)
8. key_hash in DB is SHA-256 of the plaintext key
9. Missing user_id or name returns 400
10. Non-existent user_id returns 404
11. GET `/api/keys?user_id=...` returns list of keys (no key_hash)
12. GET response keys have id, name, created_at, revoked_at
13. DELETE `/api/keys/:id` sets revoked_at (soft delete)
14. DELETE on already-revoked key returns 409
15. DELETE on non-existent key returns 404
16. keysRouter exported from keys.ts
17. Server mounts keysRouter at `/api/keys`
