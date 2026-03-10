# PDSA: JWT verification middleware

**Task:** ms-a1-3-jwt-middleware
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Protected API routes need authentication. The login endpoint (ms-a1-2) issues JWTs, but no middleware exists to verify them. Without JWT middleware, any route is publicly accessible.

## Requirements (REQ-AUTH-001)

> Express middleware: extracts JWT from Authorization header, verifies signature, attaches req.user. Protected routes return 401 without valid JWT. AC: Protected endpoint rejects bad tokens, accepts good tokens.

## Investigation

### Existing infrastructure

- **Login endpoint:** `api/routes/auth.ts` — issues JWT with payload `{ sub, email, name }` using `jsonwebtoken`
- **JWT_SECRET:** `process.env.JWT_SECRET` (read at module level in auth.ts)
- **Middleware directory:** `api/middleware/` — has `request-logger.ts`, `not-found.ts`, `error-handler.ts`
- **Express version:** 5.x (from package.json)
- **jsonwebtoken:** already installed (from ms-a1-2)
- **No TypeScript augmentation yet** — `req.user` not typed

### Design decisions

1. **New middleware file** — `api/middleware/auth.ts` in existing middleware directory. Named `requireAuth` (verb form, clear intent).
2. **Bearer token extraction** — `Authorization: Bearer <token>` header. Standard OAuth2 pattern. Return 401 if header missing or malformed.
3. **jwt.verify with JWT_SECRET** — same env var as login. If JWT_SECRET not configured, return 500 (same pattern as login endpoint).
4. **Attach decoded payload to req.user** — Express 5 `Request` type needs augmentation. Use module augmentation in a `types/express.d.ts` file.
5. **req.user shape** — `{ id: string, email: string, name: string }`. Map `sub` → `id` for cleaner downstream usage.
6. **Export as named function** — `requireAuth` middleware function, not a router. Applied per-route: `app.use('/api/keys', requireAuth, keysRouter)`.
7. **No route changes yet** — this task creates the middleware only. Applying it to specific routes is a separate concern (routes that need protection will add it individually).

## Design

### File 1: `api/middleware/auth.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; name: string };

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
}
```

### File 2: `api/types/express.d.ts` (NEW)

```typescript
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}
```

### Design notes

- **No route changes** — middleware is created but not applied to any routes yet. Future tasks (ms-a1-5, ms-a2-3) will apply it.
- **`sub` → `id` mapping** — JWT standard uses `sub` for subject, but downstream code expects `id`. Mapping happens once in middleware.
- **Expired tokens return 401** — `jwt.verify` throws `TokenExpiredError` for expired tokens, caught in the catch block. Same 401 response for all auth failures (expired, malformed, wrong signature).
- **No token refresh** — out of scope. Clients must re-login when tokens expire.
- **Type augmentation via declaration merging** — Express's `Request` type is extended globally. The `user` property is optional (`?`) since unauthenticated routes don't have it.

## Files Changed

1. `api/middleware/auth.ts` — `requireAuth` middleware function (NEW)
2. `api/types/express.d.ts` — Express Request type augmentation for `req.user` (NEW)

## Testing

1. `requireAuth` is exported from `api/middleware/auth.ts`
2. `requireAuth` is a function (middleware signature)
3. Request without Authorization header returns 401
4. Request with non-Bearer Authorization header returns 401
5. Request with `Bearer` but no token returns 401
6. Request with invalid/malformed token returns 401
7. Request with expired token returns 401
8. Request with valid token calls `next()`
9. Valid token sets `req.user.id` from JWT `sub` claim
10. Valid token sets `req.user.email` from JWT `email` claim
11. Valid token sets `req.user.name` from JWT `name` claim
12. JWT_SECRET not configured returns 500
13. `express.d.ts` declares `user` property on Express Request
14. `user` property is optional (allows unauthenticated routes)
15. Error response format is `{ error: string }`
