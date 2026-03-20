# PDSA: Brain API Authentication Enforcement

**Task:** `brain-auth-enforcement-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Brain POST /api/v1/memory serves both reads (read_only:true) and writes (contributions). Currently the same endpoint. Auth must be enforced on writes but not break reads.

### Decision: Auth Required for Contributions, Optional for Queries

The POST body contains `read_only: true` for queries. The middleware checks:
1. If `read_only: true` → skip auth, allow query
2. If contributing (no `read_only` or `read_only: false`) → require valid auth

### Auth Middleware

```typescript
// xpollination-hive/src/middleware/auth.ts
async function brainAuthMiddleware(req, res, next) {
  // Parse body to check read_only (body already parsed by express.json())
  if (req.body?.read_only === true) {
    // Query-only request — no auth needed
    req.contributor = { id: 'anonymous', name: 'Anonymous' };
    return next();
  }

  // Contribution request — auth required
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required for contributions. Use Authorization: Bearer <key>' });
  }

  const key = authHeader.replace('Bearer ', '');

  // Master key check
  if (key === process.env.BRAIN_API_KEY) {
    req.contributor = { id: 'system', name: 'System' };
    return next();
  }

  // xpo_ key validation (from brain-identity-auth task)
  const user = await validateApiKey(key);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (user.revoked) {
    return res.status(403).json({ error: 'API key revoked' });
  }

  req.contributor = { id: user.id, name: user.name };
  next();
}
```

### Endpoint Behavior Matrix

| Request | Auth Required | Contributor |
|---------|--------------|-------------|
| POST with `read_only: true` | No | anonymous |
| POST without `read_only` | Yes | From API key |
| POST with `read_only: false` | Yes | From API key |
| GET /api/v1/health | No | N/A |

### Integration with brain-identity-auth

This task extends `brain-identity-auth` by making auth **mandatory** for contributions. The `brain-identity-auth` task added the middleware but didn't enforce it — contributions without auth still went through. This task closes that gap.

### Error Messages

- **401 Missing key**: "Authentication required for contributions. Use Authorization: Bearer <key>"
- **401 Invalid key**: "Invalid API key"
- **403 Revoked**: "API key revoked"

## Do

DEV updates `xpollination-hive/src/middleware/auth.ts`:
1. Add read_only check before auth enforcement
2. Return 401/403 for unauthorized contributions
3. Allow anonymous queries (read_only:true)

## Study

Verify:
- POST with read_only:true and no auth → 200 (query works)
- POST with contribution and no auth → 401
- POST with contribution and valid key → 200 (contribution accepted)
- POST with contribution and revoked key → 403
- GET /api/v1/health → 200 (no auth)

## Act

### Design Decisions
1. **read_only:true = open**: Queries don't need auth. Brain is a knowledge service — reading should be frictionless.
2. **Body inspection for auth decision**: Unusual but necessary — same endpoint serves two purposes. The `read_only` flag is already in the protocol.
3. **Error messages include instructions**: Tell the user what to do, not just what went wrong.
4. **Master key = system**: BRAIN_API_KEY authenticates as system for agent operations.
