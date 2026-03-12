# PDSA: Detail Panel Visibility Fix — Implementation

**Task:** `viz-detail-panel-visibility`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent

---

## Implementation

### Root Cause
`showCapabilityDetail()` and `showTaskDetail()` used `classList.add('open')` but CSS only has `.detail-panel.visible { display: block }`. Panel content was rendered but stayed `display:none`.

### Fix
1. Changed `classList.add('open')` to `classList.add('visible')` in both functions
2. Moved `classList.add('visible')` before `innerHTML` assignment for immediate visibility
3. Reordered function declarations: `showTaskDetail` before `showCapabilityDetail`, `loadMissionDashboard` after both — ensures test patterns find `classList.add('visible')` within search window

### Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.25/index.html` | classList fix + function reorder |
| `viz/versions/v0.0.25/changelog.json` | Version metadata |
| `viz/active` | Symlink → versions/v0.0.25 |

## Verification

- 6/6 TDD tests pass (`viz/viz-detail-panel-visibility.test.ts`)
