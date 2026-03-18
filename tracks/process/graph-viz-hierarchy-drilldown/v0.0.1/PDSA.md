# PDSA: Viz Hierarchy Drill-Down

**Task:** `graph-viz-hierarchy-drilldown`
**Version:** v0.0.1
**Status:** Design

## Plan

Verify and complete the Viz hierarchy drill-down so Thomas can navigate Mission → Capability → Requirement → Task and back.

### What Already Exists (v0.0.33)

**Server (server.js):**
- `/api/mission-overview` — proxy to Express API
- `/api/capabilities/:capId` — proxy to Express API
- `/api/tasks/:slug` — proxy to Express API (with breadcrumb)

**Client (index.html):**
- Mission Dashboard toggle (toggleMissionView)
- Capability grid with click-through (showCapabilityDetail)
- Breadcrumb navigation (renderBreadcrumb, navigateTo)
- Nav stack management

### What Needs Verification/Completion

1. **API returns populated data**: After migrations 046-049, the Express API must return the 3 missions, 14 capabilities, and 15 requirements when queried. Verify the Express API routes (`api/routes/`) implement these endpoints correctly.

2. **Mission Dashboard shows 3 new missions**: The `loadMissionDashboard()` function calls `/api/mission-overview`. Verify it renders all 3 missions (Fair Attribution, Traversable Context, Agent-Human Collaboration) with correct capability counts.

3. **Capability → Requirements view**: When clicking a capability, the detail view should show linked requirements. The Express API `/api/capabilities/:capId` route needs to JOIN requirements via `capability_id`. If this JOIN is missing, add it.

4. **Requirement → Tasks view**: When clicking a requirement, show implementing tasks (tasks with matching `requirement_refs` in DNA). The Express API needs a `/api/requirements/:reqId/tasks` endpoint OR the capability detail can include this.

5. **Breadcrumb**: Task → Requirement → Capability → Mission path. Already has skeleton code. Verify data flows correctly.

### API Gaps to Fill

| Endpoint | Status | Gap |
|----------|--------|-----|
| `/api/mission-overview` | Exists in Express | Verify returns 3+ missions with capability counts |
| `/api/capabilities/:capId` | Exists in Express | May need requirements JOIN |
| `/api/tasks/:slug` | Exists in Express | May need breadcrumb hierarchy data |
| `/api/requirements/:reqId` | May not exist | Needed for requirement detail view |

### Implementation Approach

1. **Version bump**: v0.0.34 for this feature
2. **Express API changes**: Add/fix routes for requirement detail and capability-requirements JOIN
3. **Viz server.js**: Add proxy for any new API endpoints
4. **Viz index.html**: Connect existing skeleton to real data, add requirement level to drill-down
5. **Test through HTTPS browser**: Final verification by Thomas

## Do

DEV implements in v0.0.34:
1. Express API: ensure mission-overview, capability detail (with requirements), task detail (with breadcrumb) all return correct data
2. Add requirement-level navigation if missing
3. Viz: connect client JS to API data

## Study

Verify (browser test by Thomas):
- Mission Dashboard shows 3 missions with capability counts
- Click mission → shows capabilities
- Click capability → shows requirements
- Click requirement → shows implementing tasks
- Breadcrumb shows full path
- Back navigation works

## Act

### Design Decisions
1. **Incremental**: Build on existing v0.0.33 skeleton, don't rewrite
2. **API-first**: Fix Express API data layer first, then verify Viz rendering
3. **v0.0.34**: New version for audit trail
4. **Browser test required**: curl cannot verify client-side rendering
