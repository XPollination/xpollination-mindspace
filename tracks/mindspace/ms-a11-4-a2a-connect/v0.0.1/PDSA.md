# PDSA: A2A connect endpoint (CHECKIN handler)

**Task:** ms-a11-4-a2a-connect
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Agents need a single "connect" endpoint that accepts a filled digital twin, validates it, authenticates the agent, registers it, and returns a WELCOME message with the agent's assigned ID and SSE stream URL. Currently agents must manually call the registration endpoint and set up SSE separately. The A2A connect endpoint unifies this into one handshake.

## Requirements (AC from task DNA)

1. `POST /a2a/connect` accepts filled digital twin
2. Validates API key from twin identity
3. Resolves user from API key
4. Checks project access
5. Checks role is valid
6. Registers agent (via existing registration logic)
7. Returns WELCOME message with agent_id and stream URL

## Investigation

### Digital twin schema (twin-schema.ts)

The twin has 5 required sections:
- `identity`: agent_name, api_key, session_id
- `role`: current (liaison/pdsa/dev/qa), capabilities[]
- `project`: slug, branch
- `state`: status (idle/active/blocked/disconnected), task, lease, heartbeat, score
- `metadata`: framework, connected_at, agent_id

### Authentication flow

The twin includes `identity.api_key`. This must be validated against the `api_keys` table (same logic as `api-key-auth.ts`): hash the key, look up in DB, resolve to user. This replaces the normal `X-API-Key` header auth.

### Project access check

After resolving user, check `project_access` table for `user_id + project_slug` with appropriate role. The connect endpoint requires at least `viewer` access — the agent's role capability is separate from project access.

### Agent registration

Reuse the existing registration logic from `agents.ts` POST /register:
- Check for existing active/idle agent with same user_id + name + project_slug
- Re-registration: update session, role, capabilities, last_seen
- New: insert new agent record

### SSE stream URL

The SSE endpoint is at `GET /a2a/stream/:agent_id`. After registration, return this URL in the WELCOME message so the agent knows where to connect for push messages.

## Design

### File 1: `api/routes/a2a-connect.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const a2aConnectRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];

// POST /a2a/connect — A2A CHECKIN handler
a2aConnectRouter.post('/', (req: Request, res: Response) => {
  const twin = req.body;

  // 1. Validate twin structure (required sections)
  if (!twin?.identity || !twin?.role || !twin?.project || !twin?.state || !twin?.metadata) {
    res.status(400).json({
      type: 'ERROR',
      error: 'Invalid digital twin: missing required sections (identity, role, project, state, metadata)'
    });
    return;
  }

  // 2. Validate identity fields
  const { agent_name, api_key, session_id } = twin.identity;
  if (!agent_name || !api_key) {
    res.status(400).json({
      type: 'ERROR',
      error: 'Invalid identity: agent_name and api_key are required'
    });
    return;
  }

  // 3. Authenticate via API key
  const keyHash = createHash('sha256').update(api_key).digest('hex');
  const db = getDb();

  const keyRow = db.prepare(
    `SELECT ak.id AS key_id, ak.revoked_at, u.id, u.email, u.name
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ?`
  ).get(keyHash) as any;

  if (!keyRow) {
    res.status(401).json({ type: 'ERROR', error: 'Invalid API key' });
    return;
  }
  if (keyRow.revoked_at) {
    res.status(401).json({ type: 'ERROR', error: 'API key has been revoked' });
    return;
  }

  const userId = keyRow.id;

  // 4. Validate role
  const currentRole = twin.role?.current;
  if (currentRole && !VALID_ROLES.includes(currentRole)) {
    res.status(400).json({
      type: 'ERROR',
      error: `Invalid role '${currentRole}'. Must be one of: ${VALID_ROLES.join(', ')}`
    });
    return;
  }

  // 5. Check project access
  const projectSlug = twin.project?.slug;
  if (!projectSlug) {
    res.status(400).json({ type: 'ERROR', error: 'project.slug is required' });
    return;
  }

  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(projectSlug);
  if (!project) {
    res.status(404).json({ type: 'ERROR', error: `Project not found: ${projectSlug}` });
    return;
  }

  const access = db.prepare(
    'SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?'
  ).get(userId, projectSlug) as any;

  if (!access) {
    res.status(403).json({ type: 'ERROR', error: 'Access denied: not a member of this project' });
    return;
  }

  // 6. Register agent (reuse registration logic)
  const agentSessionId = session_id || randomUUID();
  const capabilities = twin.role?.capabilities;
  const capabilitiesJson = Array.isArray(capabilities) ? JSON.stringify(capabilities) : null;

  const existing = db.prepare(
    'SELECT id FROM agents WHERE user_id = ? AND name = ? AND (project_slug = ? OR (project_slug IS NULL AND ? IS NULL)) AND status != ?'
  ).get(userId, agent_name, projectSlug, projectSlug, 'disconnected') as any;

  let agentId: string;
  let isReconnect = false;

  if (existing) {
    // Re-registration
    agentId = existing.id;
    isReconnect = true;
    db.prepare(
      "UPDATE agents SET session_id = ?, current_role = ?, capabilities = ?, connected_at = datetime('now'), last_seen = datetime('now'), status = 'active' WHERE id = ?"
    ).run(agentSessionId, currentRole || null, capabilitiesJson, agentId);
  } else {
    // New registration
    agentId = randomUUID();
    db.prepare(
      'INSERT INTO agents (id, user_id, name, current_role, capabilities, project_slug, session_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(agentId, userId, agent_name, currentRole || null, capabilitiesJson, projectSlug, agentSessionId, 'active');
  }

  // 7. Return WELCOME message
  res.status(200).json({
    type: 'WELCOME',
    agent_id: agentId,
    session_id: agentSessionId,
    reconnect: isReconnect,
    project: {
      slug: projectSlug,
      access_role: access.role
    },
    endpoints: {
      stream: `/a2a/stream/${agentId}`,
      heartbeat: `/api/agents/${agentId}/heartbeat`,
      disconnect: `/api/agents/${agentId}/status`
    },
    timestamp: new Date().toISOString()
  });
});
```

### File 2: `api/server.ts` (UPDATE)

Mount the connect router:

```typescript
import { a2aConnectRouter } from './routes/a2a-connect.js';

// After existing a2a routes:
app.use('/a2a/connect', a2aConnectRouter);
```

## Design Decisions

1. **Separate from agents.ts** — the connect endpoint is A2A protocol, not REST CRUD. Different concerns.
2. **API key in body, not header** — the twin carries the API key in `identity.api_key`. This is the A2A way: the twin IS the authentication payload.
3. **Reuses registration SQL** — same insert/update logic as POST /register, but extracted inline rather than importing (avoids circular dependencies and keeps the connect handler self-contained).
4. **WELCOME response format** — includes agent_id, session_id, project access role, and all relevant endpoint URLs so the agent knows where to heartbeat and stream.
5. **`type: 'WELCOME'` / `type: 'ERROR'`** — A2A message type convention for structured responses.
6. **No SSE auto-connect** — the WELCOME tells the agent the stream URL. The agent then connects separately. This keeps concerns clean (HTTP request → response, then SSE for streaming).
7. **Project access required** — agents must be project members to connect. This is the authorization boundary.

## Files Changed

1. `api/routes/a2a-connect.ts` — A2A connect/CHECKIN handler (NEW)
2. `api/server.ts` — Mount connect router at `/a2a/connect` (UPDATE)

## Testing

1. POST /a2a/connect returns WELCOME with valid digital twin
2. Response includes agent_id, session_id, project info, endpoint URLs
3. Returns 400 when twin is missing required sections
4. Returns 400 when identity.agent_name is missing
5. Returns 400 when identity.api_key is missing
6. Returns 401 for invalid API key
7. Returns 401 for revoked API key
8. Returns 400 for invalid role
9. Returns 400 when project.slug is missing
10. Returns 404 when project doesn't exist
11. Returns 403 when user is not a project member
12. Creates new agent record on first connect
13. Re-registers existing agent on reconnect (isReconnect: true)
14. Re-registration updates session_id, role, capabilities, status to active
15. Response includes stream URL pointing to correct agent_id
16. Capabilities stored as JSON array
17. Agent status set to 'active' on connect
