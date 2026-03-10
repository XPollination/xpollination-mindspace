# PDSA: User table + registration endpoint

**Task:** ms-a1-1-user-registration
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The mindspace API has no user management. A `users` table and registration endpoint are needed as the foundation for the auth capability (A1). Subsequent tasks (login/JWT, API key, Google OAuth) depend on this.

## Requirements (REQ-AUTH-001)

> Migration: users table (id, email, password_hash, name, created_at). POST /api/auth/register with bcrypt password hashing. Email uniqueness constraint. AC: Can register a user, duplicate email returns 409.

## Investigation

### Existing infrastructure

- **Database:** better-sqlite3 with WAL mode, singleton pattern in `api/db/connection.ts`
- **Migration system:** `api/db/migrate.ts` — reads .sql files from `api/db/migrations/`, sorts by numeric prefix, SHA-256 checksum tracking
- **Routes pattern:** Express Router exported from `api/routes/*.ts`, mounted in `api/server.ts`
- **Error handling:** Central `errorHandler` middleware uses `err.statusCode` for non-500 errors
- **No existing auth dependencies** — bcrypt needs to be added

### Design decisions

1. **bcrypt (not argon2)** — specified in requirements. Use `bcryptjs` (pure JS, no native compilation needed) for portability on the Hetzner server. Cost factor 12 (standard).
2. **UUID v4 for user ID** — consistent with other entity IDs in the system (task IDs, etc.). Using `crypto.randomUUID()` (Node.js built-in, no dependency needed).
3. **Migration as .sql file** — follows the established migration pattern from ms-a0-7-migrations.
4. **Email validation** — basic regex check server-side. Not a full RFC 5322 parser — just reject obviously invalid input.
5. **Password requirements** — minimum 8 characters. No complexity rules (spec doesn't require them).
6. **Response: return user object without password_hash** — standard security practice.

## Design

### File 1: `api/db/migrations/001-users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
```

### File 2: `api/routes/auth.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { logger } from '../lib/logger.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = Router();

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      const err = new Error('Missing required fields: email, password, name') as any;
      err.statusCode = 400;
      throw err;
    }

    if (!EMAIL_REGEX.test(email)) {
      const err = new Error('Invalid email format') as any;
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 8) {
      const err = new Error('Password must be at least 8 characters') as any;
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    // Check for existing user
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      const err = new Error('Email already registered') as any;
      err.statusCode = 409;
      throw err;
    }

    // Hash password and create user
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    db.prepare(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
    ).run(id, email, passwordHash, name);

    logger.info({ userId: id, email }, 'User registered');

    res.status(201).json({
      id,
      email,
      name,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
```

### File 3: `api/server.ts` (update)

Add import and mount:

```typescript
import { authRouter } from './routes/auth.js';
// ...
app.use('/api/auth', authRouter);
```

### File 4: `package.json` (update)

Add bcryptjs dependency:

```json
"bcryptjs": "^2.4.3"
```

And its type definitions:

```json
"@types/bcryptjs": "^2.4.6"
```

## Files Changed

1. `api/db/migrations/001-users.sql` — users table migration (NEW)
2. `api/routes/auth.ts` — registration endpoint (NEW)
3. `api/server.ts` — mount auth router at `/api/auth`
4. `package.json` — add bcryptjs dependency

## Testing

1. Migration file `001-users.sql` exists
2. Migration creates `users` table with columns: id, email, password_hash, name, created_at
3. Email column has UNIQUE constraint
4. `auth.ts` exports `authRouter`
5. POST `/api/auth/register` accepts email, password, name
6. Missing fields return 400
7. Invalid email format returns 400
8. Password shorter than 8 chars returns 400
9. Successful registration returns 201 with user object (no password_hash)
10. Duplicate email returns 409
11. Password is hashed with bcrypt (not stored in plain text)
12. User ID is a UUID
13. `server.ts` imports and mounts authRouter at `/api/auth`
