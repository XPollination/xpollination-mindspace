# PDSA: Google OAuth integration

**Task:** ms-a1-6-google-oauth
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Users need to log in via Google accounts in addition to email/password. OAuth provides a familiar, password-free authentication flow. The system must create new users on first Google login or link to existing accounts by email.

## Requirements (REQ-AUTH-003)

> Passport.js Google OAuth strategy. Callback creates user if new or links to existing (by email). Returns JWT on success. AC: Google login flow works end-to-end, creates or links user.

## Investigation

### Existing infrastructure

- **Users table:** `id, email, password_hash (NOT NULL), name, created_at` — password_hash is NOT NULL, blocks OAuth-only users
- **Login endpoint:** `api/routes/auth.ts` — issues JWT with `{ sub, email, name }` payload
- **JWT_SECRET/JWT_EXPIRY:** env vars for JWT signing (from ms-a1-2)
- **Express 5.x** with JSON middleware
- **No Passport.js installed yet**

### Design decisions

1. **passport + passport-google-oauth20** — standard Node.js OAuth library. Google strategy handles the OAuth2 flow. Passport manages session serialization but we use stateless JWT, so sessions are disabled.
2. **Migration 005-users-oauth.sql** — ALTER TABLE to make `password_hash` nullable and add `google_id TEXT UNIQUE`. SQLite doesn't support ALTER COLUMN, so we use a table rebuild pattern (create new table, copy data, drop old, rename).
3. **New routes file `api/routes/oauth.ts`** — separate from auth.ts. Two routes: `GET /api/auth/google` (initiates OAuth flow) and `GET /api/auth/google/callback` (handles Google's redirect).
4. **Find-or-create by email** — on callback, check if a user with the Google email already exists. If yes, update their `google_id`. If no, create a new user with `google_id` and NULL `password_hash`.
5. **JWT issued on callback** — after find-or-create, sign a JWT with the same payload as login (`sub, email, name`). Redirect to frontend with token in query param.
6. **Frontend redirect** — `GET /api/auth/google/callback` redirects to `FRONTEND_URL?token=<jwt>`. The frontend extracts the token and stores it. `FRONTEND_URL` is an env var.
7. **GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET** — from environment. Required for OAuth flow. Fail fast if not configured.
8. **Scope: profile + email** — minimal Google scopes needed.

## Design

### File 1: `api/db/migrations/005-users-oauth.sql` (NEW)

```sql
-- Make password_hash nullable and add google_id
-- SQLite requires table rebuild for ALTER COLUMN

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  google_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, name, created_at)
SELECT id, email, password_hash, name, created_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;
```

### File 2: `api/routes/oauth.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const oauthRouter = Router();

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const googleId = profile.id;

      if (!email) {
        return done(new Error('No email in Google profile'));
      }

      const db = getDb();
      let user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) as { id: string; email: string; name: string } | undefined;

      if (user) {
        // Link Google account to existing user
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
      } else {
        // Create new user (no password)
        const id = randomUUID();
        db.prepare('INSERT INTO users (id, email, name, google_id) VALUES (?, ?, ?, ?)').run(id, email, name, googleId);
        user = { id, email, name };
      }

      done(null, user);
    }
  ));
}

// Initiate Google OAuth flow
oauthRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Google OAuth callback
oauthRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string; name: string };

    if (!JWT_SECRET) {
      res.status(500).json({ error: 'JWT_SECRET not configured' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.redirect(`${FRONTEND_URL}?token=${token}`);
  }
);

// Failure route
oauthRouter.get('/google/failure', (req: Request, res: Response) => {
  res.status(401).json({ error: 'Google authentication failed' });
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount + passport initialization:
```typescript
import passport from 'passport';
import { oauthRouter } from './routes/oauth.js';
// ...
app.use(passport.initialize());
app.use('/api/auth', oauthRouter);
```

### File 4: `package.json` (UPDATE)

Add dependencies:
```json
"passport": "^0.7.0",
"passport-google-oauth20": "^2.0.0"
```

And types:
```json
"@types/passport": "^1.0.0",
"@types/passport-google-oauth20": "^2.0.0"
```

### Design notes

- **No sessions** — `session: false` in passport.authenticate. We use JWT-only auth.
- **passport.initialize()** — required middleware even without sessions. Must be added to Express app.
- **Table rebuild for SQLite** — SQLite doesn't support `ALTER TABLE ... ALTER COLUMN`. The rebuild pattern (create new table, copy data, drop old, rename) is the standard approach. Existing `password_hash` values are preserved. ON DELETE CASCADE from api_keys is maintained because the table name is the same after rename.
- **google_id UNIQUE** — prevents two users from linking the same Google account.
- **Email matching** — if a user registered with email/password and later logs in with Google (same email), their accounts are linked by setting `google_id`.
- **Frontend redirect with token** — typical SPA OAuth pattern. The token is in the URL query param, which the frontend reads and stores in localStorage/memory.
- **Conditional strategy registration** — Passport Google strategy is only registered if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present. Server still starts without Google OAuth configured.

## Files Changed

1. `api/db/migrations/005-users-oauth.sql` — make password_hash nullable, add google_id (NEW)
2. `api/routes/oauth.ts` — Google OAuth routes with find-or-create logic (NEW)
3. `api/server.ts` — add passport.initialize() and mount oauthRouter (UPDATE)
4. `package.json` — add passport + passport-google-oauth20 + types (UPDATE)

## Testing

1. Migration 005-users-oauth.sql exists
2. After migration, `password_hash` column is nullable
3. After migration, `google_id` column exists and is UNIQUE
4. After migration, existing user data is preserved
5. `oauthRouter` exported from `api/routes/oauth.ts`
6. GET `/api/auth/google` route exists
7. GET `/api/auth/google/callback` route exists
8. GET `/api/auth/google/failure` returns 401
9. Google strategy registered with passport (when env vars present)
10. Existing user by email: google_id is updated (linked)
11. New user: created with google_id and NULL password_hash
12. Callback issues JWT with sub, email, name claims
13. Callback redirects to FRONTEND_URL with token in query param
14. No email in Google profile returns error
15. `passport` is in package.json dependencies
16. `passport-google-oauth20` is in package.json dependencies
17. `@types/passport` is in package.json devDependencies
18. `@types/passport-google-oauth20` is in package.json devDependencies
19. passport.initialize() middleware added to Express app
20. Session is disabled (session: false)
