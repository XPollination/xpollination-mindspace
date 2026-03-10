# PDSA: Agent pool query endpoint (for viz)

**Task:** ms-a7-5-agent-pool
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The viz dashboard needs a single endpoint to display the agent pool for a project: how many agents per role, their statuses, and what they're working on. Currently there's `GET /api/agents?project_slug=X` which returns raw agent rows but no aggregation. The viz would need multiple requests and client-side aggregation, which is inefficient and couples the viz to the agents table schema.

## Requirements (AC from task DNA)

1. `GET /api/projects/:slug/agents` returns agent pool for a project
2. Returns count per role (pdsa, dev, qa, liaison, orchestrator)
3. Returns active agents with status
4. Returns current task per agent (future — depends on task claiming endpoint)
5. Returns accurate real-time data

## Investigation

### Existing agents table (008-agents.sql)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  current_role TEXT,
  capabilities TEXT,
  project_slug TEXT REFERENCES projects(slug),
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'disconnected')),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT
);
```

### Existing routes

- `GET /api/agents` — flat list with optional `project_slug` and `status` filters
- `GET /api/agents/:id` — single agent by ID
- No project-scoped agent endpoint

### Task/lease tables

No task or lease tables exist on the develop branch yet. "Current task" is a future concern (depends on ms-a3-3-task-claiming, ms-a3-4-lease-creation). The endpoint should include a `current_task` field per agent set to `null` for now, ready for future population.

### Route mounting

`projectsRouter` already nests `membersRouter` at `/:slug/members` and `brainRouter` at `/:slug/brain`. The agent pool router follows the same pattern: `/:slug/agents`.

## Design

### File 1: `api/routes/agent-pool.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const agentPoolRouter = Router({ mergeParams: true });

agentPoolRouter.use(requireApiKeyOrJwt);

// GET /api/projects/:slug/agents — agent pool for a project
agentPoolRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Get all agents for this project (exclude disconnected by default, include with ?include_disconnected=true)
  const includeDisconnected = req.query.include_disconnected === 'true';
  let agentSql = 'SELECT * FROM agents WHERE project_slug = ?';
  if (!includeDisconnected) {
    agentSql += " AND status != 'disconnected'";
  }
  agentSql += ' ORDER BY current_role, connected_at DESC';

  const agents = db.prepare(agentSql).all(slug) as any[];

  // Count by role
  const byRole: Record<string, number> = {};
  for (const role of ['pdsa', 'dev', 'qa', 'liaison', 'orchestrator']) {
    byRole[role] = agents.filter(a => a.current_role === role).length;
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const status of ['active', 'idle', 'disconnected']) {
    byStatus[status] = agents.filter(a => a.status === status).length;
  }

  // Map agents to response shape
  const agentList = agents.map(a => ({
    id: a.id,
    name: a.name,
    current_role: a.current_role,
    status: a.status,
    capabilities: a.capabilities ? JSON.parse(a.capabilities) : [],
    session_id: a.session_id,
    connected_at: a.connected_at,
    last_seen: a.last_seen,
    disconnected_at: a.disconnected_at,
    current_task: null // Future: populated from lease/task tables
  }));

  res.status(200).json({
    project_slug: slug,
    total: agents.length,
    by_role: byRole,
    by_status: byStatus,
    agents: agentList
  });
});
```

Key design decisions:
- **Separate router file** — follows the pattern of `members.ts` and `brain.ts` as nested project routes
- **Excludes disconnected by default** — viz typically shows active pool; `?include_disconnected=true` for full history
- **`by_role` aggregation** — counts per role for viz summary badges
- **`by_status` aggregation** — counts per status for health indicators
- **`current_task: null`** — placeholder for future lease/task integration, avoids breaking change later
- **Capabilities parsed from JSON** — stored as JSON string in DB, returned as array
- **Sorted by role then connected_at** — groups agents by role for viz display

### File 2: `api/routes/projects.ts` (UPDATE)

Add import and mount the agent pool router:

```typescript
import { agentPoolRouter } from './agent-pool.js';

// After existing nested routes:
projectsRouter.use('/:slug/agents', agentPoolRouter);
```

## Files Changed

1. `api/routes/agent-pool.ts` — New agent pool query endpoint (NEW)
2. `api/routes/projects.ts` — Mount agent pool router at `/:slug/agents` (UPDATE)

## Testing

1. GET /api/projects/:slug/agents returns 200 with pool data for valid project
2. GET /api/projects/:slug/agents returns 404 for non-existent project
3. Response includes `total`, `by_role`, `by_status`, `agents` fields
4. `by_role` counts match actual agents per role
5. `by_status` counts match actual agents per status
6. Disconnected agents excluded by default
7. `?include_disconnected=true` includes disconnected agents
8. `agents` array contains correct fields (id, name, current_role, status, capabilities, session_id, connected_at, last_seen, current_task)
9. `current_task` is null for all agents (placeholder)
10. `capabilities` is parsed from JSON string to array
11. Agents sorted by role then connected_at DESC
12. Empty project (no agents) returns `total: 0` with zero counts
13. Returns 401 when not authenticated
14. Multiple agents with different roles counted correctly
