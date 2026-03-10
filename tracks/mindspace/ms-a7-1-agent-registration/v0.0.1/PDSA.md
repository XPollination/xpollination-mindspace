# PDSA: Agents table + registration endpoint

**Task:** ms-a7-1-agent-registration
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The Mindspace API needs to track agents (AI assistants) that connect and work on tasks. Currently agents are implicit — they authenticate via API keys or JWT but have no dedicated identity, role tracking, or session management. Before building lease bonds (A7-2), status lifecycle (A7-3), or role switching (A7-4), we need an agents table and a registration endpoint.

## Requirements (REQ-AGENT-001)

> Migration: agents table (id/agent_id, user_id, name, current_role, capabilities, project_slug, session_id, status, connected_at, last_seen, disconnected_at). POST /api/agents/register with API key auth. AC: Agent registered, gets agent_id.

## Investigation

### Existing infrastructure

- **Users table:** id, email, password_hash, name, created_at
- **API keys table:** `api/db/migrations/004-api-keys.sql` — id, user_id FK, key_hash, name, created_at, revoked_at
- **Auth middleware:** `requireApiKeyOrJwt` — sets `req.user` with `{id, email, name}`
- **Projects table:** id, slug UNIQUE, name, description, created_at, created_by
- **Next migration:** 008 (007 is project_access)

### Design decisions

1. **agent_id vs id** — Use `id TEXT PRIMARY KEY` with UUID for consistency with other tables. The requirement mentions `id/agent_id` — we'll use `id` as the column and return it as `agent_id` in the response for API clarity.
2. **user_id FK** — Each agent belongs to a user (the API key owner). One user can have multiple agents (e.g., pdsa, dev, qa).
3. **capabilities as JSON** — TEXT column storing JSON array. Validated in handler. Example: `["plan","review","design"]`.
4. **project_slug FK** — Optional. Agent may register without a project initially. References projects(slug).
5. **session_id** — Unique per registration. Allows tracking reconnections. Agent can re-register with a new session_id.
6. **status values** — `active`, `idle`, `disconnected`. Set to `active` on registration. Lifecycle managed by ms-a7-3.
7. **Re-registration** — If an agent with the same user_id + name + project_slug exists and is not disconnected, update its session_id and connected_at instead of creating a duplicate. This prevents orphaned entries on agent restarts.
8. **UNIQUE constraint** — No UNIQUE on (user_id, name, project_slug) because we allow historical disconnected entries. Re-registration logic handles dedup in the handler.

## Design

### File 1: `api/db/migrations/008-agents.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  current_role TEXT,
  capabilities TEXT,
  project_slug TEXT REFERENCES projects(slug),
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_slug);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id);
```

### File 2: `api/routes/agents.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const agentsRouter = Router();

const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator'];
const VALID_STATUSES = ['active', 'idle', 'disconnected'];

agentsRouter.use(requireApiKeyOrJwt);

// POST /api/agents/register — register agent
agentsRouter.post('/register', (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, current_role, capabilities, project_slug, session_id } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  if (current_role && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  // Validate capabilities is array if provided
  if (capabilities !== undefined) {
    if (!Array.isArray(capabilities)) {
      res.status(400).json({ error: 'capabilities must be an array' });
      return;
    }
  }

  const db = getDb();

  // Verify project exists if specified
  if (project_slug) {
    const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(project_slug);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
  }

  // Check for existing active/idle agent with same user_id + name + project_slug
  const existing = db.prepare(
    'SELECT id FROM agents WHERE user_id = ? AND name = ? AND (project_slug = ? OR (project_slug IS NULL AND ? IS NULL)) AND status != ?'
  ).get(user.id, name, project_slug || null, project_slug || null, 'disconnected') as any;

  const agentSessionId = session_id || randomUUID();
  const capabilitiesJson = capabilities ? JSON.stringify(capabilities) : null;

  if (existing) {
    // Re-registration: update existing agent
    db.prepare(
      'UPDATE agents SET session_id = ?, current_role = ?, capabilities = ?, connected_at = datetime(\'now\'), last_seen = datetime(\'now\'), status = ? WHERE id = ?'
    ).run(agentSessionId, current_role || null, capabilitiesJson, 'active', existing.id);

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(existing.id);
    res.status(200).json({ agent_id: (agent as any).id, ...(agent as any) });
    return;
  }

  // New registration
  const id = randomUUID();
  db.prepare(
    'INSERT INTO agents (id, user_id, name, current_role, capabilities, project_slug, session_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, user.id, name, current_role || null, capabilitiesJson, project_slug || null, agentSessionId, 'active');

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({ agent_id: id, ...(agent as any) });
});

// GET /api/agents — list agents (optional filters: project_slug, status)
agentsRouter.get('/', (req: Request, res: Response) => {
  const { project_slug, status } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params: any[] = [];

  if (project_slug) {
    sql += ' AND project_slug = ?';
    params.push(project_slug);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY connected_at DESC';
  const agents = db.prepare(sql).all(...params);
  res.status(200).json(agents);
});

// GET /api/agents/:id — get agent by id
agentsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.status(200).json(agent);
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount:
```typescript
import { agentsRouter } from './routes/agents.js';
// ...
app.use('/api/agents', agentsRouter);
```

## Files Changed

1. `api/db/migrations/008-agents.sql` — agents table with user_id FK, project_slug FK, session_id, status (NEW)
2. `api/routes/agents.ts` — POST /register (with re-registration), GET / (with filters), GET /:id (NEW)
3. `api/server.ts` — mount agentsRouter at /api/agents (UPDATE)

## Testing

1. `api/db/migrations/008-agents.sql` exists
2. Migration creates agents table
3. agents has columns: id, user_id, name, current_role, capabilities, project_slug, session_id, status, connected_at, last_seen, disconnected_at
4. user_id references users(id)
5. project_slug references projects(slug)
6. `api/routes/agents.ts` exists
7. agentsRouter exported
8. POST /api/agents/register creates agent with 201
9. POST returns agent_id in response
10. POST requires name (400 on missing)
11. POST validates current_role (400 on invalid)
12. POST validates capabilities is array (400 on non-array)
13. POST returns 404 for unknown project_slug
14. POST sets status to 'active' on registration
15. POST sets connected_at and last_seen to current time
16. POST generates session_id if not provided
17. POST re-registration: returns 200 and updates existing agent (same user+name+project, not disconnected)
18. POST re-registration: updates session_id and connected_at
19. GET /api/agents returns array of agents
20. GET /api/agents?project_slug=x filters by project
21. GET /api/agents?status=active filters by status
22. GET /api/agents/:id returns agent or 404
23. All endpoints require authentication (401 without auth)
24. server.ts mounts agentsRouter at /api/agents
