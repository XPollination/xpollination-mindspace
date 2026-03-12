# PDSA: Suspect Status Visualization — Rework v4 (Develop Base)

**Task:** `t3-7-suspect-viz`
**Version:** v0.0.3
**Date:** 2026-03-12
**Author:** DEV agent (rework4)

---

## Rework Context

**Rework reason:** BASE VERSION WRONG — previous versions built from `main` (v0.0.11).

## Implementation

v0.0.20 built from v0.0.19 (which already had server-side `/api/suspect-links/stats` endpoint from cumulative server.js). Added client-side only:

1. **suspect-status-bar HTML** in kanban header — suspect (red #ef4444), cleared (green #22c55e), accepted_risk (amber #f59e0b) counts
2. **Progress bar** showing clearance percentage ((cleared + accepted_risk) / total)
3. **loadSuspectStats() function** — fetches stats, updates counts, hides bar when total=0
4. **Called on init** (after loadProjects) and **each poll cycle** (when data changes)

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.20/index.html` | suspect-status-bar HTML, loadSuspectStats(), called on init + poll |
| `viz/versions/v0.0.20/server.js` | No changes (endpoint already present from v0.0.18) |
| `viz/versions/v0.0.20/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.20 |

## Verification

- 17/17 TDD tests pass (`viz/t3-7-suspect-viz.test.ts`)
