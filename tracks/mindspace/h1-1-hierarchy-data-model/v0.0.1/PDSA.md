# PDSA: Missions + capabilities data model

**Task:** h1-1-hierarchy-data-model
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The mindspace PM system currently has a flat task structure. For multi-project orchestration, we need a hierarchy: **missions** (high-level goals) contain **capabilities** (deliverable chunks of functionality), which link to existing requirements and tasks. This enables progress tracking at mission and capability levels.

## Requirements (REQ-HIERARCHY-001)

> Add missions and capabilities tables to mindspace database. Mission has: id, title, description, status. Capability has: id, mission_id, title, description, status, dependency_ids. Link capabilities to requirements and tasks.

## Investigation

### Existing infrastructure

- **Database:** better-sqlite3, WAL mode, foreign keys ON (`api/db/connection.ts`)
- **Migration system:** SQL files in `api/db/migrations/`, numeric prefix sort, SHA-256 checksum (`api/db/migrate.ts`)
- **Current migrations:** none yet (empty `migrations/` directory)
- **Existing entities:** The mindspace API has no requirements/tasks tables yet in the API DB (those are in the PM system's `data/xpollination.db`). This migration creates the hierarchy tables in the mindspace API DB.

### Design decisions

1. **UUID v4 for IDs** — consistent with existing entity patterns (task IDs in PM system, user IDs in ms-a1-1).
2. **Status as TEXT with CHECK constraint** — enforces valid values at the DB level.
3. **dependency_ids as JSON TEXT** — SQLite has no native array type. Store as JSON array `["cap-uuid-1", "cap-uuid-2"]`. Simple, query-able via `json_each()`.
4. **Linking tables** — `capability_requirements` and `capability_tasks` junction tables for many-to-many relationships. A capability can link to multiple requirements and tasks; a task can belong to multiple capabilities.
5. **Mission statuses:** `draft`, `active`, `complete`, `cancelled` — simple lifecycle.
6. **Capability statuses:** `draft`, `active`, `blocked`, `complete`, `cancelled` — includes `blocked` for dependency tracking.
7. **Two migration files** — 002 for missions/capabilities, 003 for linking tables. Keeps them logically separated and allows 001 to be the users table (ms-a1-1).

## Design

### File 1: `api/db/migrations/002-missions-capabilities.sql`

```sql
-- Missions: high-level goals/projects
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'complete', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Capabilities: deliverable chunks within a mission
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'blocked', 'complete', 'cancelled')),
  dependency_ids TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX idx_capabilities_mission ON capabilities(mission_id);
CREATE INDEX idx_capabilities_status ON capabilities(status);
```

### File 2: `api/db/migrations/003-capability-links.sql`

```sql
-- Link capabilities to requirements (many-to-many)
CREATE TABLE IF NOT EXISTS capability_requirements (
  capability_id TEXT NOT NULL,
  requirement_ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (capability_id, requirement_ref),
  FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

-- Link capabilities to tasks (many-to-many)
CREATE TABLE IF NOT EXISTS capability_tasks (
  capability_id TEXT NOT NULL,
  task_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (capability_id, task_slug),
  FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

CREATE INDEX idx_cap_req_capability ON capability_requirements(capability_id);
CREATE INDEX idx_cap_req_requirement ON capability_requirements(requirement_ref);
CREATE INDEX idx_cap_tasks_capability ON capability_tasks(capability_id);
CREATE INDEX idx_cap_tasks_task ON capability_tasks(task_slug);
```

### Design notes

- **`requirement_ref` is TEXT, not FK** — requirements may live in a different database or be external references (e.g., "REQ-AUTH-001"). Using TEXT allows flexibility.
- **`task_slug` is TEXT, not FK** — tasks currently live in the PM database (`data/xpollination.db`), not the mindspace API database. Cross-DB foreign keys aren't possible in SQLite. Using slug as the natural key.
- **`sort_order`** on capabilities — allows explicit ordering within a mission for display purposes.
- **`ON DELETE CASCADE`** — deleting a mission removes its capabilities; deleting a capability removes its links. Clean cascade for data integrity.
- **No CRUD endpoints in this task** — the description says "tables, migrations" only. CRUD endpoints will be separate tasks.

## Files Changed

1. `api/db/migrations/002-missions-capabilities.sql` — missions + capabilities tables (NEW)
2. `api/db/migrations/003-capability-links.sql` — linking tables (NEW)

## Testing

1. Migration file `002-missions-capabilities.sql` exists
2. Migration creates `missions` table with columns: id, title, description, status, created_at, updated_at
3. Missions status has CHECK constraint: draft, active, complete, cancelled
4. Migration creates `capabilities` table with columns: id, mission_id, title, description, status, dependency_ids, sort_order, created_at, updated_at
5. Capabilities status has CHECK constraint: draft, active, blocked, complete, cancelled
6. Capabilities has foreign key to missions (mission_id)
7. `dependency_ids` defaults to '[]'
8. Migration file `003-capability-links.sql` exists
9. Creates `capability_requirements` table with composite PK (capability_id, requirement_ref)
10. Creates `capability_tasks` table with composite PK (capability_id, task_slug)
11. Both linking tables have cascade delete on capability_id
12. Index exists on capabilities.mission_id
13. Index exists on capabilities.status
14. Indexes exist on linking table columns
