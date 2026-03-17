# PDSA: Viz Project Selector After Login

**Task:** ms-viz-project-selector
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-003 short-term

## Problem

After login, Viz shows "local" from filesystem fallback instead of user's API projects. No project selection flow.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Fetch GET /api/projects with user JWT after login | API has access control |
| D2 | Show project cards/dropdown for selection | User picks their project |
| D3 | Kanban loads tasks for selected project | Project-scoped data |
| D4 | Selected project persists in localStorage | Auto-select on next visit |
| D5 | Single project → auto-select, no picker | Streamlined UX |
| D6 | Replaces filesystem discovery for logged-in users | Clean separation |

### Acceptance Criteria

- AC1: After login, user sees their projects from API
- AC2: Selecting a project loads its tasks in Kanban
- AC3: Selected project persists across page reloads
- AC4: Single-project users skip selection (auto-select)
- AC5: No "local" or filesystem paths visible

### Files to Change

- `viz/versions/v0.0.X/index.html` — Project selector UI + fetch logic
- `viz/server.js` — Ensure /api/projects proxied correctly

## Do / Study / Act

(To be completed)
