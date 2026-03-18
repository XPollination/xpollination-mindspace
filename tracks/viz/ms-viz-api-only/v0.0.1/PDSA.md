# PDSA: Viz — Replace All Direct SQLite with API Calls

**Task:** ms-viz-api-only
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.5b

## Problem

viz/server.js has 32 direct SQLite calls via better-sqlite3. This is a security boundary violation — Viz should be a pure HTTP client reading from the API, not directly accessing the database.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Replace all `new Database()` / `.prepare()` calls with `fetch()` to API | Security boundary: Viz has no direct DB access |
| D2 | Remove `better-sqlite3` import from viz/server.js | Clean separation |
| D3 | Viz authenticates to API via internal service token (env var) | Internal auth, not user-facing |
| D4 | API_PORT configurable via env var (default 3100) | Deployment flexibility |
| D5 | Preserve ETag/since polling pattern via API data endpoint | Already implemented in ms-api-viz-endpoints |
| D6 | Settings read/write goes through API settings endpoint | Already implemented |
| D7 | Use version-bump.sh for viz version increment | Mandatory per version bump gate |

### Migration Map (32 SQLite calls → API fetch)

| Current SQLite Call | Replacement API Endpoint |
|--------------------|-------------------------|
| SELECT FROM mindspace_nodes (full/incremental) | GET /api/data?since=X |
| SELECT FROM stations | GET /api/agents |
| SELECT FROM capabilities | GET /api/projects/:slug/capabilities |
| SELECT FROM missions | GET /api/projects/:slug/missions |
| SELECT FROM system_settings | GET /api/settings/liaison-approval-mode |
| UPDATE system_settings | PUT /api/settings/liaison-approval-mode |
| SELECT/UPDATE mindspace_nodes (confirm/rework) | POST /api/projects/:slug/tasks/:slug/transition |

### Acceptance Criteria

- AC1: No `better-sqlite3` import in viz/server.js
- AC2: No `Database()` constructor calls in viz/server.js
- AC3: No `.prepare()` calls in viz/server.js
- AC4: All data fetched via API endpoints
- AC5: Viz works without xpollination.db file accessible
- AC6: Internal service token used for API auth
- AC7: ETag/since polling preserved
- AC8: Settings read/write works through API

### Files to Change

- `viz/server.js` — Remove SQLite, add fetch calls
- `viz/package.json` — Remove better-sqlite3 dependency (if only viz uses it)

### Test Plan

1. Remove DB file from Viz container/process path
2. Start Viz + API → Viz loads data from API
3. All Viz features work (task list, detail panel, mission overview, settings)
4. ETag polling returns incremental updates

## Do

(Implementation by DEV agent — use version-bump.sh first)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
