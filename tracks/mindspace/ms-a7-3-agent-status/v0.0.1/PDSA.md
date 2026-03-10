# PDSA: Agent status lifecycle (active/idle/disconnected)

**Task:** ms-a7-3-agent-status
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Agents register but there's no mechanism to detect when they go silent. An agent that crashes or loses connection stays "active" forever. We need automatic status transitions based on heartbeat activity, and cleanup of claimed resources when agents disconnect.

## Requirements (AC from task DNA)

1. Status transitions: active → idle (no heartbeat 5min) → disconnected (30min)
2. Background job updates statuses automatically
3. On disconnect: release claimed tasks (future — depends on task claiming endpoint)
4. AC: Status transitions happen automatically

## Investigation

### Existing agents table (008-agents.sql)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_role TEXT,
  capabilities TEXT,
  project_slug TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'disconnected')),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT
);
```

The `last_seen` column exists but is never updated after registration.

### Existing routes (agents.ts)

- POST /register — sets status='active', updates last_seen on re-registration
- GET / — list with filters
- GET /:id — get by id
- No heartbeat endpoint, no PATCH for status

### Design decisions

1. **Heartbeat endpoint** — POST /api/agents/:id/heartbeat updates `last_seen` to now
2. **Status sweep** — setInterval job (every 60s) scans agents, transitions based on time thresholds
3. **Thresholds** — configurable via env: AGENT_IDLE_MINUTES=5, AGENT_DISCONNECT_MINUTES=30
4. **On disconnect** — set disconnected_at, optionally release leases (future, when lease table exists)
5. **PATCH status** — manual status update (for graceful disconnect)

## Design

### File 1: `api/routes/agents.ts` (UPDATE)

**Change 1: Add heartbeat endpoint**

```typescript
// POST /api/agents/:id/heartbeat — update last_seen
agentsRouter.post('/:id/heartbeat', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare(
    "UPDATE agents SET last_seen = datetime('now'), status = 'active' WHERE id = ? AND status != 'disconnected'"
  ).run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Agent not found or already disconnected' });
    return;
  }

  res.status(200).json({ ok: true, last_seen: new Date().toISOString() });
});
```

A heartbeat also reactivates an idle agent (sets status back to 'active'). Disconnected agents must re-register.

**Change 2: Add PATCH status endpoint**

```typescript
// PATCH /api/agents/:id/status — manual status update
agentsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const db = getDb();
  const disconnectedAt = status === 'disconnected' ? "datetime('now')" : 'NULL';

  const result = db.prepare(
    `UPDATE agents SET status = ?, disconnected_at = ${status === 'disconnected' ? "datetime('now')" : 'NULL'}, last_seen = datetime('now') WHERE id = ?`
  ).run(status, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(200).json(agent);
});
```

### File 2: `api/services/agent-status-sweep.ts` (NEW)

```typescript
import { getDb } from '../db/connection.js';

const IDLE_MINUTES = parseInt(process.env.AGENT_IDLE_MINUTES || '5', 10);
const DISCONNECT_MINUTES = parseInt(process.env.AGENT_DISCONNECT_MINUTES || '30', 10);

export function runAgentStatusSweep(): { idled: number; disconnected: number } {
  const db = getDb();

  // Active → idle: no heartbeat for IDLE_MINUTES
  const idled = db.prepare(
    `UPDATE agents SET status = 'idle'
     WHERE status = 'active'
     AND last_seen < datetime('now', '-${IDLE_MINUTES} minutes')`
  ).run();

  // Idle → disconnected: no heartbeat for DISCONNECT_MINUTES
  const disconnected = db.prepare(
    `UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now')
     WHERE status = 'idle'
     AND last_seen < datetime('now', '-${DISCONNECT_MINUTES} minutes')`
  ).run();

  return { idled: idled.changes, disconnected: disconnected.changes };
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;

export function startAgentStatusSweep(intervalMs: number = 60000): void {
  if (sweepInterval) return; // Already running
  sweepInterval = setInterval(() => {
    try {
      runAgentStatusSweep();
    } catch (err) {
      console.error('Agent status sweep error:', err);
    }
  }, intervalMs);
}

export function stopAgentStatusSweep(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}
```

### File 3: `api/server.ts` (UPDATE)

Add import and call `startAgentStatusSweep()` after server starts listening.

```typescript
import { startAgentStatusSweep } from './services/agent-status-sweep.js';

// After app.listen():
startAgentStatusSweep();
```

## Files Changed

1. `api/routes/agents.ts` — Add POST /:id/heartbeat + PATCH /:id/status (UPDATE)
2. `api/services/agent-status-sweep.ts` — Background sweep job (NEW)
3. `api/server.ts` — Start sweep on server boot (UPDATE)

## Testing

1. POST /heartbeat returns 200 and updates last_seen for active agent
2. POST /heartbeat reactivates idle agent (sets status back to active)
3. POST /heartbeat returns 404 for disconnected agent
4. POST /heartbeat returns 404 for non-existent agent
5. PATCH /status changes status to idle
6. PATCH /status changes status to disconnected (sets disconnected_at)
7. PATCH /status changes status to active (clears disconnected_at)
8. PATCH /status returns 400 for invalid status
9. PATCH /status returns 404 for non-existent agent
10. runAgentStatusSweep() transitions active → idle after IDLE_MINUTES
11. runAgentStatusSweep() transitions idle → disconnected after DISCONNECT_MINUTES
12. runAgentStatusSweep() does NOT transition active → disconnected directly (must go through idle)
13. runAgentStatusSweep() does NOT transition already-disconnected agents
14. startAgentStatusSweep() is idempotent (calling twice doesn't create duplicate intervals)
15. stopAgentStatusSweep() stops the interval
16. Sweep respects configurable thresholds (AGENT_IDLE_MINUTES, AGENT_DISCONNECT_MINUTES)
