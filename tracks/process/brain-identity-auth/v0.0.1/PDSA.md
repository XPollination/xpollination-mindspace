# PDSA: Brain Identity Authentication

**Task:** `brain-identity-auth`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Brain trusts `contributor_id` from request body. Anyone with an API key can claim any identity. Robin's work was attributed to Thomas because both used the same master key.

### Solution
Brain validates `xpo_` API keys against the Mindspace users table. Contributor identity is DERIVED from the authenticated key, not from the request body.

### Authentication Flow

```
POST /api/v1/memory
Authorization: Bearer xpo_abc123...

{
  "prompt": "...",
  "agent_id": "agent-pdsa",     ← agent identity (still from body)
  "agent_name": "PDSA"          ← agent identity (still from body)
}

Brain middleware:
1. Extract key from Authorization header
2. Validate key against api_keys table (Mindspace DB)
3. Look up user: api_keys.user_id → users.id, users.name
4. Set contributor_id = user.id, contributor_name = user.name
5. Request body agent_id/agent_name = which agent is acting
```

### Identity Model

| Field | Source | Meaning |
|-------|--------|---------|
| `contributor_id` | From authenticated API key → user.id | WHO contributed (human identity) |
| `contributor_name` | From authenticated API key → user.name | Display name of contributor |
| `agent_id` | From request body | WHICH agent contributed (agent-pdsa, agent-dev, etc.) |
| `agent_name` | From request body | Agent display name |

### Key Types

| Key | Purpose | Authentication |
|-----|---------|---------------|
| `BRAIN_API_KEY` (master) | System operations, backward compat | Authenticates as system user |
| `xpo_abc123...` (per-user) | User-specific contributions | Authenticates as that user |

### Middleware Implementation

```typescript
// xpollination-hive/src/middleware/auth.ts
async function authenticateContributor(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const key = authHeader.replace('Bearer ', '');

  // Check master key first (backward compat)
  if (key === process.env.BRAIN_API_KEY) {
    req.contributor = { id: 'system', name: 'System' };
    return next();
  }

  // Validate xpo_ key against Mindspace API
  // Option A: HTTP call to Mindspace API /api/auth/validate-key
  // Option B: Direct DB query if same machine
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

### Key Validation

Option B (direct DB, recommended — same machine):

```typescript
async function validateApiKey(key) {
  // Hash the key (api_keys stores hashed keys)
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Query Mindspace DB
  const db = getMindspaceDb(); // read-only connection to mindspace.db
  const result = db.prepare(`
    SELECT ak.user_id, u.name, ak.revoked_at
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_hash = ?
  `).get(hash);

  if (!result) return null;
  return { id: result.user_id, name: result.name, revoked: !!result.revoked_at };
}
```

### Backward Compatibility

- Master `BRAIN_API_KEY` continues to work → authenticates as `system`
- Existing thoughts keep current attribution (no retroactive change)
- `GET /api/v1/health` remains unauthenticated
- Read-only brain queries still work with master key

## Do

DEV implements:
1. Auth middleware in xpollination-hive
2. Apply middleware to POST /api/v1/memory
3. Derive contributor_id/name from authenticated user
4. Master key backward compat
5. Document per-user key setup for Claude Web AI

## Study

Verify:
- POST with Thomas's xpo_ key → contributor_id = thomas
- POST with Robin's xpo_ key → contributor_id = robin
- POST with master BRAIN_API_KEY → contributor_id = system
- POST without key → 401
- POST with revoked key → 403
- GET /api/v1/health → 200 (no auth required)

## Act

### Design Decisions
1. **Direct DB query over HTTP**: Brain and Mindspace are on same machine. No network hop needed.
2. **Master key as system**: Backward compat. Agents using BRAIN_API_KEY are system-level.
3. **No retroactive changes**: Robin's 8 thoughts stay as-is. Correct attribution starts now.
4. **Agent vs contributor**: Two separate identity axes. Contributor = human, Agent = AI agent acting for that human.
5. **Hash lookup**: api_keys table stores hashed keys. Brain hashes the incoming key before lookup.
