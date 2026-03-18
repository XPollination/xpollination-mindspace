# PDSA: Create Viz v0.0.35 — Progressive Hierarchy Drilldown UI

**Task:** `viz-v0035-hierarchy-drilldown`
**Version:** v0.0.1
**Status:** Design

## Plan

Create v0.0.35 from v0.0.33 with progressive hierarchy drilldown. The API already returns mission-grouped data (root server.js). Only the index.html client needs updating.

### Implementation Steps (from DNA)

1. **Copy** v0.0.33 → v0.0.35 (full directory)
2. **Replace** `loadMissionDashboard()` to fetch `/api/mission-overview` and render mission cards from `data.missions` array (not flat `data.capabilities`)
3. **Add** `navStack`, `missionOverviewData`, `getHealthColor()`, `renderBreadcrumb()`, `navigateTo()`
4. **Add** `showMissionDetail(missionId)` — capability cards within selected mission
5. **Update** changelog.json, symlink viz/active → v0.0.35
6. **Preserve** v0.0.33 as rollback point

### UI Specification

**Level 0 (Mission Overview):**
- Mission cards with left border color (health), title, WHY description
- Capability count, task progress bar (X/Y tasks Z%)
- Click → `showMissionDetail(id)`

**Level 1 (Mission Detail):**
- Breadcrumb: `Missions > [Mission Name]`
- Capability cards with progress, requirement count
- Click → existing `showCapabilityDetail(id)`

### Design Validation

The DNA spec is implementation-ready. Key design decisions validated:
- **Copy-on-write**: v0.0.33 untouched, v0.0.35 is the new version
- **API contract**: `/api/mission-overview` returns nested missions→capabilities→requirements (already implemented in root server.js)
- **Progressive disclosure**: Mission → Capability → (existing Requirement+Task detail)
- **Health colors**: green >80%, yellow >50%, red <50% — standard thresholds

## Do

DEV follows the exact steps in the DNA description. No deviation needed — the spec is complete.

## Study

Verify:
- v0.0.35 directory exists, v0.0.33 unchanged (diff)
- Mission Overview shows missions with real counts
- Click mission → capability view
- Breadcrumb navigation works
- Settings, Logout, version display all present

## Act

### Design Decisions
1. **v0.0.35 not v0.0.34**: Skipping v0.0.34 (was allocated to graph-viz-hierarchy-drilldown which had different scope)
2. **Client-only change**: Root server.js already has correct queries. Only index.html changes.
3. **navStack pattern**: Reuses existing breadcrumb infrastructure from v0.0.33 skeleton
