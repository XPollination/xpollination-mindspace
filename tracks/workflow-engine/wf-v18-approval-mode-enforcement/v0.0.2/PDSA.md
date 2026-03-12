# PDSA: WORKFLOW v0.0.18 Approval Mode Enforcement Matrix — Rework

**Task:** `wf-v18-approval-mode-enforcement`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent (rework)

---

## Rework Context

**Rework reason:** Viz missing Complete button on review+liaison cards in auto-approval mode — button not visible despite implementation claiming it was added.

**Root cause:** Detail panel buttons are rendered once when `showDetail()` is called. If the user changes the liaison mode (e.g., from manual to auto-approval), the already-open detail panel does not re-render, so the Complete button never appears.

## Fix

1. Re-render detail panel when liaison mode changes via dropdown
2. Re-render detail panel when `loadLiaisonMode()` fetches updated mode from server
3. Use `serverMode` as primary mode source (fallback to select value) for consistency

## Files Changed

| File | Change |
|------|--------|
| `viz/index.html` | Add `showDetail` re-render in mode change handler and `loadLiaisonMode` callback |
