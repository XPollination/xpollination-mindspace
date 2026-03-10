# PDSA: API key verification middleware

**Task:** ms-a1-5-api-key-middleware
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Agents and CI/CD tools need to authenticate via API keys instead of JWT tokens. The API key generation endpoint (ms-a1-4) creates and stores keys, but no middleware resolves them to users. API key auth should work alongside JWT auth.

## Requirements (REQ-AUTH-002)

> Express middleware: extracts API key from X-API-Key header, resolves to user_id. Falls through to JWT middleware if no API key present. Revoked keys return 401. AC: API key resolves to correct user, revoked key rejected.

## Investigation

### Existing infrastructure

- **API keys table:** `api_keys` with `key_hash`, `user_id`, `revoked_at` (from ms-a1-4)
- **Hash function:** SHA-256 via `createHash('sha256')` in `api/routes/keys.ts`
- **JWT middleware:** `requireAuth` in `api/middleware/auth.ts` (from ms-a1-3) — extracts Bearer token, sets `req.user`
- **req.user shape:** `{ id: string, email: string, name: string }` (from ms-a1-3 type augmentation)
- **Database:** better-sqlite3 singleton via `getDb()`

### Design decisions

1. **New middleware file** — `api/middleware/api-key-auth.ts`. Separate from JWT middleware for single-responsibility.
2. **X-API-Key header** — standard convention for API key auth. Distinct from Authorization header used by JWT.
3. **Hash-then-lookup** — hash the incoming key with SHA-256, query `api_keys` table by `key_hash`. Same hash function as key generation.
4. **Check revoked_at** — if `revoked_at` is set, reject with 401. Revoked keys should not authenticate.
5. **Resolve user** — join `api_keys` with `users` table to get email and name. Set `req.user` with same shape as JWT middleware.
6. **Fall-through design** — if no `X-API-Key` header present, call `next()` without setting `req.user`. This allows chaining: API key middleware runs first, JWT middleware runs second. If either sets `req.user`, the request is authenticated.
7. **Combined auth middleware** — export a `requireApiKeyOrJwt` function that chains both middlewares. Routes use this single middleware for dual-auth support.

## Design

### File 1: `api/middleware/api-key-auth.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    // No API key header — fall through (let JWT middleware handle it)
    next();
    return;
  }

  const keyHash = hashKey(apiKey);
  const db = getDb();

  const row = db.prepare(
    'SELECT ak.user_id, ak.revoked_at, u.email, u.name FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_hash = ?'
  ).get(keyHash) as { user_id: string; revoked_at: string | null; email: string; name: string } | undefined;

  if (!row) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  if (row.revoked_at) {
    res.status(401).json({ error: 'API key has been revoked' });
    return;
  }

  req.user = {
    id: row.user_id,
    email: row.email,
    name: row.name
  };

  next();
}
```

### File 2: `api/middleware/require-auth.ts` (NEW)

Combined middleware that accepts either API key or JWT:

```typescript
import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './api-key-auth.js';
import { requireAuth } from './auth.js';

export function requireApiKeyOrJwt(req: Request, res: Response, next: NextFunction): void {
  apiKeyAuth(req, res, (err?: any) => {
    if (err) { next(err); return; }

    // If API key middleware set req.user, we're done
    if (req.user) {
      next();
      return;
    }

    // Fall through to JWT middleware
    requireAuth(req, res, next);
  });
}
```

### Design notes

- **No route changes** — middleware is created but not applied to routes yet. Future tasks will apply `requireApiKeyOrJwt` to protected routes.
- **Same req.user shape** — both API key and JWT auth set the same `{ id, email, name }` shape. Downstream code doesn't need to know which auth method was used.
- **SHA-256 hash lookup** — indexed on `key_hash` (UNIQUE constraint from ms-a1-4). O(1) lookup.
- **Separate error messages** — "Invalid API key" vs "API key has been revoked" gives the caller useful feedback. This is safe because API keys are long random strings (not user-guessable like passwords).
- **Fall-through pattern** — `apiKeyAuth` calls `next()` if no X-API-Key header. This is not an error — it allows JWT auth to take over. Only returns 401 if an API key IS provided but is invalid/revoked.

## Files Changed

1. `api/middleware/api-key-auth.ts` — `apiKeyAuth` middleware (NEW)
2. `api/middleware/require-auth.ts` — `requireApiKeyOrJwt` combined middleware (NEW)

## Testing

1. `apiKeyAuth` is exported from `api/middleware/api-key-auth.ts`
2. `apiKeyAuth` is a function (middleware signature)
3. Request without X-API-Key header calls `next()` (falls through)
4. Request without X-API-Key header does NOT set `req.user`
5. Request with valid API key sets `req.user.id` to the key's user_id
6. Request with valid API key sets `req.user.email` from users table
7. Request with valid API key sets `req.user.name` from users table
8. Request with invalid API key returns 401
9. Request with revoked API key returns 401
10. API key is SHA-256 hashed before database lookup
11. `requireApiKeyOrJwt` is exported from `api/middleware/require-auth.ts`
12. `requireApiKeyOrJwt` authenticates via API key when X-API-Key header present
13. `requireApiKeyOrJwt` falls through to JWT when no API key header
14. `requireApiKeyOrJwt` returns 401 when neither API key nor JWT provided
15. Error response format is `{ error: string }`
