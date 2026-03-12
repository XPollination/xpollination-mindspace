# PDSA: Capability Drill-Down View — Rework

**Task:** `h1-6-viz-capability-drilldown`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent (rework)

---

## Rework Context

**Rework reason:** VERSIONING VIOLATION — Viz changes edited root files in-place instead of creating a new version directory.

**Root cause:** Implementation modified `viz/server.js` and `viz/index.html` directly instead of creating `viz/versions/v0.0.15/` with the changes.

## Fix

1. Create `viz/versions/v0.0.15/` with `server.js`, `index.html`, `changelog.json`
2. Version contains mission overview and capability detail endpoints, drill-down UI
3. Update `viz/active` symlink to latest version (v0.0.15)

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.15/server.js` | GET /api/mission-overview and GET /api/capabilities/:capId endpoints |
| `viz/versions/v0.0.15/index.html` | loadMissionDashboard(), showCapabilityDetail(), hideDetail() |
| `viz/versions/v0.0.15/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.15 |
