# PDSA: Fix Viz Server Data Layer

**Task:** `viz-hierarchy-data-layer`
**Version:** v0.0.1
**Status:** Design

## Plan

Fix viz/server.js to return mission-grouped data with correct task counting via requirement_refs.

### Problem
Current `/api/mission-overview` proxies to Express API which counts tasks via `capability_tasks` junction table. But tasks are linked through `requirement_refs` in mindspace_nodes DNA, not capability_tasks.

### Changes Required

#### 1. `/api/mission-overview` — Mission-grouped response
Replace the proxy-to-Express pattern with direct SQLite queries on the viz working directory DB.

**Query chain:**
```sql
-- Get missions
SELECT id, slug, title, description, status FROM missions WHERE status = 'active';

-- For each mission, get capabilities
SELECT id, title, description, status, sort_order
FROM capabilities WHERE mission_id = ?;

-- For each capability, get requirements
SELECT id, req_id_human, title FROM requirements WHERE capability_id = ?;

-- For each requirement, count implementing tasks
SELECT COUNT(*) as task_count FROM mindspace_nodes
WHERE type = 'task' AND dna_json LIKE '%' || ? || '%';

-- For each requirement, count complete tasks
SELECT COUNT(*) as complete_count FROM mindspace_nodes
WHERE type = 'task' AND status = 'complete' AND dna_json LIKE '%' || ? || '%';
```

**Response format:**
```json
{
  "missions": [{
    "id": "mission-fair-attribution",
    "title": "Fair Attribution",
    "description": "...",
    "status": "active",
    "capabilities": [{
      "id": "cap-auth",
      "title": "CAP-AUTH",
      "description": "...",
      "task_count": 18,
      "complete_count": 15,
      "progress_percent": 83,
      "requirements": [
        { "req_id_human": "REQ-AUTH-001", "title": "User Login" },
        { "req_id_human": "REQ-AUTH-002", "title": "Invite Management" }
      ]
    }]
  }]
}
```

#### 2. `/api/capabilities/:capId/requirements` — New endpoint
Returns requirements for a capability with implementing tasks.

```json
{
  "capability": { "id": "cap-auth", "title": "...", "mission_id": "..." },
  "requirements": [{
    "req_id_human": "REQ-AUTH-001",
    "title": "User Login",
    "tasks": [
      { "slug": "ms-auth-e2e-design", "title": "...", "status": "complete" }
    ]
  }]
}
```

#### 3. Project deduplication
When both main and test worktree exist, use only the DB from the viz server's own working directory (the `data/xpollination.db` relative to `process.cwd()`).

#### 4. Database access
The viz server.js can use `better-sqlite3` directly (already a dependency). Open the mindspace API DB (from discovered project path) in read-only mode for hierarchy data.

### Dual DB Pattern
- **mindspace_nodes** (workflow data): `data/xpollination.db` in each project
- **missions/capabilities/requirements** (hierarchy): API DB at `data/mindspace.db`
- Viz server needs to read BOTH databases for the hierarchy view

## Do

DEV modifies viz/server.js:
1. Add direct SQLite queries for hierarchy data
2. Replace Express API proxy for mission-overview
3. Add `/api/capabilities/:capId/requirements` endpoint
4. Add project deduplication logic

## Study

Verify:
- `/api/mission-overview` returns 3 missions with nested capabilities
- Task counts are non-zero for AUTH, WORKFLOW, VIZ groups
- No duplicate data
- `/api/capabilities/:capId/requirements` returns requirements with task lists

## Act

### Design Decisions
1. **Direct SQLite over proxy**: Viz server queries DB directly instead of proxying to Express API. Simpler, faster, no dependency on Express server running.
2. **Dual DB reads**: Hierarchy (missions/capabilities/requirements) from API DB, tasks from workflow DB. Both in same project directory.
3. **LIKE pattern for task counting**: `dna_json LIKE '%REQ-AUTH-001%'` matches requirement_refs in DNA. Not perfect (could match substring), but sufficient for counting.
4. **Read-only mode**: All DB access is read-only. No risk of corruption.
