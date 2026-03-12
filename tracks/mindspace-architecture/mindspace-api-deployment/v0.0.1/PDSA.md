# PDSA: Deploy Mindspace API as Single Backend

**Task:** `mindspace-api-deployment`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The system has two parallel data paths:
1. **Legacy:** `mindspace_nodes` table in `xpollination.db`, accessed by `interface-cli.js` (agents) and `viz/server.js` (dashboard)
2. **New API:** Express server at `api/server.ts` with 33 migrations, proper relational schema (`tasks`, `missions`, `capabilities`, `requirements`, etc.), auth middleware, and RESTful routes — but **never built or started**

The legacy `mindspace_nodes` stores everything in a single table with a `dna_json` blob. The new API has a proper relational schema. This task deploys the API and migrates legacy data.

### Current State Analysis

**Legacy system (running):**
- 285 tasks in xpollination-mcp-server, 36 in HomePage
- All data in `mindspace_nodes.dna_json` (avg 3KB per node)
- `interface-cli.js` provides agent CRUD with workflow validation
- `viz/server.js` exports data via `/api/data` endpoint
- Groups: A0-A16, D0-D3, H1, P0, T1-T3, VIZ, WF, bugfix, process

**New API (never started):**
- `api/server.ts` — Express on port 3100
- 33 SQL migrations (users, projects, missions, capabilities, tasks, requirements, etc.)
- Auth: JWT + API key middleware
- Routes: projects, tasks, missions, capabilities, requirements, agents, A2A, marketplace
- `tasks` table: proper relational columns (project_slug FK, requirement_id FK, status CHECK, current_role CHECK, claimed_by FK)
- `npm run api:migrate` and `npm run api` scripts exist

**Critical gap:** The new `tasks` table has NO `dna_json` column. It has fixed columns: `title`, `description`, `status`, `current_role`, `claimed_by`, `feature_flag_name`. The legacy `dna_json` contains 30+ fields (findings, implementation, pdsa_ref, qa_review, depends_on, etc.) that have NO corresponding columns.

### Design Decisions

**D1: Phased deployment — API first, viz migration second.**

Phase 1 (this task): Get API running, seed data, migrate legacy data. Phase 2 (separate task): Switch viz from direct SQLite to API calls. Phase 3 (separate task): Retire interface-cli.js.

Reasoning: A big-bang migration risks breaking the running system. Phased approach keeps the legacy system working during transition.

**D2: Add `dna_json TEXT` column to the API's `tasks` table.**

The new API's `tasks` table has 10 fixed columns but no equivalent for the 30+ fields in `dna_json`. Options:
- (a) Create 30+ columns for every DNA field — over-engineered, fragile, constantly evolving
- (b) Keep `dna_json` as a flexible extension field alongside relational columns — pragmatic
- (c) Ignore DNA fields — breaks the entire agent workflow

Decision: **(b)** — Add a new migration `033-task-dna-json.sql` that adds `dna_json TEXT` to `tasks`. The fixed columns (`title`, `description`, `status`, `current_role`) remain as the relational "index", while `dna_json` holds the full semantic payload. This matches the pattern that works in production today.

**D3: Migration script maps legacy `mindspace_nodes` → new `tasks` table.**

Create `api/db/seed-from-legacy.ts`:
1. Open legacy `xpollination.db` (read-only)
2. Read all `mindspace_nodes` rows
3. For each node:
   - Parse `dna_json` → extract `title`, `description`, `role` (→ `current_role`), `status`, `group`
   - Map to new `tasks` row with `project_slug` = project name
   - Preserve `dna_json` as-is in the new column
   - Map `group` to capability link via `capability_tasks` junction
4. Create project(s), default mission, and capabilities from distinct `group` values
5. Create admin user and API key for seed

**D4: Group-to-capability mapping.**

| Group prefix | Capability name | Description |
|-------------|----------------|-------------|
| A0-A16 | api-{N} | API subsystem capabilities |
| D0-D3 | documentation-{N} | Documentation |
| H1 | homepage | HomePage features |
| T1-T3 | traceability-{N} | Traceability features |
| VIZ | visualization | Viz dashboard |
| WF | workflow | Workflow engine |
| bugfix | bugfix | Bug fixes |
| process | process | Process improvements |

Create one mission: "XPollination Platform" → capabilities from groups → tasks linked via `capability_tasks`.

**D5: interface-cli.js wraps API calls (Phase 2, not this task).**

For Phase 1, agents continue using `interface-cli.js` with direct SQLite access to `xpollination.db`. The API runs alongside on port 3100. Once the API is verified, Phase 2 switches `interface-cli.js` to make HTTP calls instead of direct DB access.

**D6: Port allocation — API 3100, viz 4200/4100 unchanged.**

No consolidation. The API serves JSON on 3100. Viz continues serving HTML on 4200/4100. In Phase 2, viz will call API endpoints instead of reading SQLite directly.

**D7: npm start = build + migrate + start API.**

Update `package.json`:
```json
"start:api": "npm run api:migrate && npm run api"
```
First-run: migrations create all tables, seed script populates data.

**D8: Auth — auto-seed on first run.**

Create `api/db/seed.ts`:
- Creates admin user (thomas) with bcrypt password
- Creates API keys for each agent role (pdsa, dev, qa, liaison)
- Creates default project "xpollination-mcp-server"
- Idempotent (skips if already seeded)

### Files Changed

| File | Change |
|------|--------|
| `api/db/migrations/033-task-dna-json.sql` | Add `dna_json TEXT` column to tasks |
| `api/db/seed.ts` | Auto-seed admin user, API keys, default project |
| `api/db/seed-from-legacy.ts` | Migrate legacy mindspace_nodes to new tasks table |
| `package.json` | Add `start:api` script, update `api:migrate` |

### Migration Script Pseudocode

```typescript
// seed-from-legacy.ts
import Database from 'better-sqlite3';

const legacyDb = new Database('data/xpollination.db', { readonly: true });
const apiDb = getDb(); // new mindspace.db

// 1. Create project
apiDb.prepare('INSERT OR IGNORE INTO projects (slug, name, created_by) VALUES (?, ?, ?)').run('xpollination-mcp-server', 'XPollination MCP Server', adminUserId);

// 2. Create mission
const missionId = randomUUID();
apiDb.prepare('INSERT INTO missions (id, title) VALUES (?, ?)').run(missionId, 'XPollination Platform');

// 3. Create capabilities from distinct groups
const groups = legacyDb.prepare("SELECT DISTINCT json_extract(dna_json, '$.group') as grp FROM mindspace_nodes WHERE json_extract(dna_json, '$.group') IS NOT NULL").all();
for (const { grp } of groups) {
  const capId = randomUUID();
  apiDb.prepare('INSERT INTO capabilities (id, mission_id, title) VALUES (?, ?, ?)').run(capId, missionId, grp);
  capMap[grp] = capId;
}

// 4. Migrate nodes to tasks
const nodes = legacyDb.prepare('SELECT * FROM mindspace_nodes').all();
for (const node of nodes) {
  const dna = JSON.parse(node.dna_json || '{}');
  apiDb.prepare(`INSERT INTO tasks (id, project_slug, title, description, status, current_role, dna_json, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    node.id, 'xpollination-mcp-server',
    dna.title || node.slug, dna.description || null,
    node.status, dna.role || null,
    node.dna_json, node.created_at, node.updated_at, adminUserId
  );
  // Link to capability
  if (dna.group && capMap[dna.group]) {
    apiDb.prepare('INSERT INTO capability_tasks (capability_id, task_slug) VALUES (?, ?)').run(capMap[dna.group], node.slug);
  }
}
```

### Risks and Mitigations

**R1: Dual data sources during transition.** Agents write to `xpollination.db`, API reads from `mindspace.db`. Risk of drift.
Mitigation: Phase 1 is deploy-and-verify only. No agent switches until Phase 2.

**R2: Legacy `dna_json` fields not in relational schema.** 30+ fields would require 30+ migrations.
Mitigation: D2 — keep `dna_json` as extension field. Relational columns are indexes, DNA is the source of truth.

**R3: Group-to-capability mapping incomplete.** Some tasks may have NULL or unknown groups.
Mitigation: Create "uncategorized" capability as catch-all. Log warnings for unmapped tasks.

**R4: API never tested in production.** 33 migrations, Express server, auth — never started.
Mitigation: Phase 1 builds and starts API in TEST environment first. Run migration on copy of data. Verify before touching PROD.

### Verification Plan

1. `npm run api:migrate` — all 33+ migrations apply without error
2. `npm run api` — server starts on port 3100, `/health` returns 200
3. Seed script creates admin user and API keys
4. Legacy migration script imports all 321 tasks
5. `GET /api/projects/xpollination-mcp-server/tasks` returns imported tasks
6. Each task has `dna_json` preserved from legacy
7. Capability linking: every task linked via `capability_tasks`
8. Auth: API key required for write operations
9. Legacy system continues working (no interference)

### Out of Scope (Future Tasks)

- Viz switch to API calls (Phase 2)
- interface-cli.js replacement (Phase 2)
- Agent API key distribution (Phase 2)
- HomePage project migration (after mcp-server verified)
- A2A protocol activation
- Marketplace features

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
