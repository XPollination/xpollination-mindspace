# PDSA: Suspect Status Visualization — Rework

**Task:** `t3-7-suspect-viz`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent (rework)

---

## Rework Context

**Rework reason:** VERSIONING VIOLATION — Viz changes edited root files in-place instead of creating a new version directory.

**Root cause:** Implementation modified `viz/server.js` and `viz/index.html` directly instead of creating `viz/versions/v0.0.14/` with the changes.

## Fix

1. Create `viz/versions/v0.0.14/` with `server.js`, `index.html`, `changelog.json`
2. Version contains suspect links stats endpoint and status bar UI
3. Update `viz/active` symlink to latest version (v0.0.15, cumulative with all tasks)

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.14/server.js` | GET /api/suspect-links/stats endpoint with project=all support |
| `viz/versions/v0.0.14/index.html` | Suspect status bar with suspect/cleared/accepted_risk counts, progress bar |
| `viz/versions/v0.0.14/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.15 |
