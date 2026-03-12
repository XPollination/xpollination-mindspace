# PDSA: Capability Drill-Down View — Rework v4 (Develop Base)

**Task:** `h1-6-viz-capability-drilldown`
**Version:** v0.0.3
**Date:** 2026-03-12
**Author:** DEV agent (rework4)

---

## Rework Context

**Rework reason:** BASE VERSION WRONG — previous versions built from `main` (v0.0.11).

## Implementation

v0.0.21 built from v0.0.20. Server endpoints already present. Replaced client stub with real implementation:

1. **loadMissionDashboard()** — fetches `/api/mission-overview`, renders cap-cards with progress bars and task counts
2. **showCapabilityDetail(capId)** — fetches `/api/capabilities/:capId`, renders requirements list (req_id_human, title, status) and tasks with status badges + role colors
3. **Back navigation** via hideDetail() button
4. `window.showCapabilityDetail` exposed for onclick

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.21/index.html` | Real loadMissionDashboard(), showCapabilityDetail(), Back button |
| `viz/versions/v0.0.21/server.js` | No changes (endpoints already present from v0.0.18) |
| `viz/versions/v0.0.21/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.21 |

## Verification

- 15/15 TDD tests pass (`viz/h1-6-viz-capability-drilldown.test.ts`)
- All 68 tests pass across all 4 task test files
