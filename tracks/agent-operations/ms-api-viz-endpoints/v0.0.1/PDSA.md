# PDSA: API — Add Missing Endpoints for Viz

**Task:** ms-api-viz-endpoints
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.5a

## Problem

The Viz server (port 4100/4200) reads xpollination.db directly via 35+ SQLite queries. To remove direct DB access (security boundary), the Express API (port 3100/3101) must provide all data Viz needs. Investigation reveals that **30+ API route modules already exist** in `api/routes/` but are **not wired into** `api/server.ts`. The gap is primarily wiring, not writing.

## Plan

### Key Finding

The following route files exist with full implementations but are NOT mounted in `api/server.ts`:
- `tasks.ts` — Task CRUD, claiming, dependencies, transitions
- `capabilities.ts` — Capability CRUD with requirement/task linking
- `missions.ts` — Mission overview with nested capability progress
- `requirements.ts` — Requirement management with versioning
- `data.ts` — Project data export with ETag support
- `task-transitions.ts` — State machine validation, auto-unblock, approval
- Plus 24+ more route modules

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Wire existing route modules into api/server.ts | Routes are implemented but orphaned; just need mounting |
| D2 | Priority routes: tasks, capabilities, missions, requirements, data, task-transitions | These 6 cover what Viz needs for task polling, hierarchy view, and transitions |
| D3 | Add settings route for liaison-approval-mode | Currently hardcoded in viz/server.js lines 614-680; needs API abstraction |
| D4 | Wire incremental polling (data.ts with ETag/since) | Already implemented in route; supports change_seq watermark |
| D5 | Do NOT modify Viz to call API yet (separate task ms-viz-api-only) | This task only ensures API endpoints exist; Viz migration is Phase 2 |
| D6 | Verify each wired route responds correctly with test curl calls | Smoke test each endpoint after wiring |

### Acceptance Criteria

- AC1: api/server.ts mounts tasks, capabilities, missions, requirements, data, task-transitions routes
- AC2: GET /api/projects/:slug/tasks returns task list (with optional since parameter)
- AC3: GET /api/projects/:slug/tasks/:slug returns full task DNA
- AC4: GET/PUT /api/settings/liaison-approval-mode works via API (not just via Viz)
- AC5: GET /api/projects/:slug/missions returns mission hierarchy with capability progress
- AC6: POST /api/projects/:slug/tasks/:slug/transition executes workflow engine transitions
- AC7: GET /api/projects/:slug/data?since=X supports ETag incremental polling
- AC8: All new API routes are behind auth middleware (existing pattern)

### Files to Change

- `api/server.ts` — Mount the orphaned route modules (primary change)
- `api/routes/settings.ts` — May need new route for settings if not existing
- Existing route files should NOT need changes (already implemented)

### Test Plan

1. Start API server, curl each endpoint with valid auth
2. Compare API response to Viz direct-query response for same data
3. Verify auth middleware blocks unauthenticated requests
4. Verify ETag/since polling returns incremental updates

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
