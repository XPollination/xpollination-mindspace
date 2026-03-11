# PDSA: Agent WELCOME Enrichment — Include Capability Context

**Task:** h1-8-agent-welcome-capability
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

Enrich the A2A WELCOME response with capability context so agents understand the bigger picture when they connect. Include: active mission, capability assignments, capability progress, and sibling task status.

### Current WELCOME Response (a2a-connect.ts)

```json
{
  "type": "WELCOME",
  "agent_id": "...",
  "session_id": "...",
  "reconnect": false,
  "project": { "slug": "...", "access_role": "..." },
  "endpoints": { "stream": "...", "heartbeat": "...", "disconnect": "..." },
  "timestamp": "..."
}
```

No capability or mission context.

### Design

#### 1. Enrich WELCOME with Capability Summary

Add a `context` field to the WELCOME response:

```json
{
  "type": "WELCOME",
  "...existing fields...",
  "context": {
    "mission": {
      "id": "mission-v1",
      "title": "Mindspace v1.0",
      "status": "active"
    },
    "capabilities": [
      {
        "id": "cap-foundation",
        "title": "Foundation",
        "status": "active",
        "progress_percent": 67,
        "your_tasks": 2,
        "total_tasks": 6
      }
    ],
    "pending_tasks": [
      {
        "id": "...",
        "slug": "task-slug",
        "title": "Task title",
        "status": "ready",
        "capability": "Foundation"
      }
    ]
  }
}
```

`your_tasks` = tasks where role matches the connecting agent's role.
`pending_tasks` = tasks in ready/active status for this agent's role.

#### 2. Implementation

In `a2a-connect.ts`, after agent registration, before returning WELCOME:

```ts
// Query active mission for the project
const mission = db.prepare(
  "SELECT id, title, status FROM missions WHERE status = 'active' LIMIT 1"
).get();

// Query capabilities with progress (reuse h1-5 overview logic)
let capabilities = [];
if (mission) {
  const caps = db.prepare(
    'SELECT id, title, status FROM capabilities WHERE mission_id = ?'
  ).all(mission.id);
  // For each cap, compute progress (simplified inline)
  capabilities = caps.map(cap => ({
    ...cap,
    progress_percent: computeCapProgress(db, cap.id),
    your_tasks: countTasksForRole(db, cap.id, currentRole),
    total_tasks: countTotalTasks(db, cap.id)
  }));
}

// Query pending tasks for this agent's role
const pendingTasks = db.prepare(
  "SELECT t.id, t.slug, t.title, t.status FROM tasks t WHERE t.role = ? AND t.status IN ('ready', 'active') LIMIT 10"
).all(currentRole);
```

#### 3. Helper Functions

Extract into `api/services/welcome-context.ts`:

```ts
export function buildWelcomeContext(db: Database, mission: Mission | null, role: string): WelcomeContext
```

This keeps `a2a-connect.ts` clean and makes the context computation testable.

### Files to Change

1. `api/services/welcome-context.ts` — CREATE: `buildWelcomeContext()` function
2. `api/routes/a2a-connect.ts` — UPDATE: Call `buildWelcomeContext()`, add to WELCOME response

### Out of Scope

- Task claiming from WELCOME context (agents use existing claim flow)
- Real-time capability progress updates via SSE (handled by existing infra)

## Do

Implementation by DEV agent.

## Study

- WELCOME response includes `context.mission` when active mission exists
- WELCOME includes `context.capabilities` with progress
- WELCOME includes `context.pending_tasks` for agent's role
- Graceful fallback when no mission/capabilities exist (empty context)

## Act

Connect as agent via A2A on TEST (:4200) and verify WELCOME includes capability context.
