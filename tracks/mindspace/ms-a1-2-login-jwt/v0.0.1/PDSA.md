# PDSA: Login endpoint + JWT token issuance

**Task:** ms-a1-2-login-jwt
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Users can register (ms-a1-1) but cannot authenticate. The system needs a login endpoint that validates credentials and issues a JWT token for subsequent API authentication.

## Requirements (REQ-AUTH-001)

> POST /api/auth/login validates credentials, returns JWT. Token includes user_id, email, name. Configurable expiry (default 24h). AC: Login returns valid JWT, invalid credentials return 401.

## Investigation

### Existing infrastructure

- **Registration endpoint:** `api/routes/auth.ts` — POST `/api/auth/register` with bcryptjs, email validation, users table
- **Database:** better-sqlite3 with WAL mode, users table has: id, email, password_hash, name, created_at
- **Server mount:** `app.use('/api/auth', authRouter)` in `api/server.ts`
- **No JWT library installed yet** — need to add one

### Design decisions

1. **jsonwebtoken package** — most popular Node.js JWT library (50M+ weekly downloads), well-maintained, pure JS. Alternative `jose` is newer but jsonwebtoken is the ecosystem standard and simpler API.
2. **Add login to existing auth.ts** — same router, same mount point. Login is POST `/api/auth/login`, registration is POST `/api/auth/register`. Keeps auth logic together.
3. **JWT_SECRET from environment** — required env var, fail fast if missing. No hardcoded secrets.
4. **JWT_EXPIRY configurable** — default `24h`, configurable via `JWT_EXPIRY` env var. jsonwebtoken supports human-readable strings (`1h`, `7d`, `30m`).
5. **Token payload** — `sub` (user_id), `email`, `name`. Standard JWT `sub` claim for subject. Minimal payload — no sensitive data.
6. **401 for all auth failures** — same error message for "user not found" and "wrong password" to prevent user enumeration.
7. **bcrypt.compare for password check** — uses existing bcryptjs (already a dependency from ms-a1-1).

## Design

### File 1: `api/routes/auth.ts` (update)

Add login endpoint to existing auth router:

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Missing required fields: email, password' });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT not configured' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(email) as { id: string; email: string; password_hash: string; name: string } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});
```

### File 2: `package.json` (update)

Add jsonwebtoken dependency:
```json
"jsonwebtoken": "^9.0.0"
```

And types:
```json
"@types/jsonwebtoken": "^9.0.0"
```

### Design notes

- **Same auth router** — no new file needed, login appends to existing authRouter in auth.ts
- **No new server.ts changes** — already mounted at `/api/auth`
- **Response includes both token AND user object** — client gets user info without a separate request
- **password_hash never leaves the server** — query selects it for comparison only, not included in response
- **JWT_SECRET check at request time** — allows server to start without JWT_SECRET (registration still works), but login fails gracefully with 500

## Files Changed

1. `api/routes/auth.ts` — add POST `/login` endpoint with JWT issuance (UPDATE)
2. `package.json` — add `jsonwebtoken` + `@types/jsonwebtoken` dependencies (UPDATE)

## Testing

1. POST `/api/auth/login` endpoint exists
2. Missing email or password returns 400
3. Non-existent email returns 401 with "Invalid credentials"
4. Wrong password returns 401 with "Invalid credentials" (same message as #3)
5. Correct credentials return 200 with `token` and `user` object
6. `user` object contains `id`, `email`, `name` (no `password_hash`)
7. Token is a valid JWT with `sub`, `email`, `name` claims
8. Token `sub` matches the user's `id`
9. Token expiry defaults to 24h when `JWT_EXPIRY` not set
10. `jsonwebtoken` is in package.json dependencies
11. `@types/jsonwebtoken` is in package.json devDependencies
12. jwt.sign is called with `JWT_SECRET` from environment
13. bcrypt.compare is used for password validation
