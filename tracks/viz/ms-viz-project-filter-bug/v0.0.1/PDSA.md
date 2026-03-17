# PDSA: Bug — Project Filter Shows 0 Tasks

**Task:** ms-viz-project-filter-bug
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 bugfix

## Problem

Individual project selection shows 0 tasks, only "All Projects" works. Complete column shows 0 (related to default filter excluding complete status).

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Investigate: project selector sends slug but data API may not filter by it | Mismatch between project selection and data retrieval |
| D2 | Fix: ensure /api/data?project=slug filters tasks correctly | Data API must support project filtering |
| D3 | Fix: if tasks have no project_slug field, add _project tagging on data fetch | Tasks need project association |
| D4 | Fix Complete column: verify default filter vs complete status display | May be intentional (default filter) or bug |
| D5 | "All Projects" shows all tasks — this path works as baseline | Regression test target |

### Acceptance Criteria

- AC1: Selecting a specific project shows its tasks (not 0)
- AC2: "All Projects" continues to work
- AC3: Complete column shows completed tasks when filter allows
- AC4: Project filter and data API consistent

### Files to Change

- `viz/server.js` or `viz/versions/v0.0.X/index.html` — Fix project filter data flow
- Possibly API data endpoint — Support project filtering

### Test Plan

1. Select specific project → tasks appear
2. Select "All Projects" → all tasks appear
3. Toggle filter to include complete → complete tasks appear

## Do / Study / Act

(To be completed)
