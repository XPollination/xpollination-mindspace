# PDSA: Fix Static File Serving from Active Symlink

**Task:** `viz-v0022-rebuild-from-v0017`
**Version:** v0.0.3
**Date:** 2026-03-12
**Author:** DEV agent

---

## Root Cause

`viz/server.js` served static files from `__dirname` (viz/ root) instead of `viz/active/` symlink. This made the entire versioning system decorative — version directories existed but the server ignored them, always serving the stale root `viz/index.html`.

## Fix

Changed the static file serving section (lines 645-656) in `viz/server.js`:
- Added `staticRoot` variable that resolves to `path.join(__dirname, 'active')` (with fallback to `__dirname` if symlink missing)
- Changed `path.join(__dirname, filePath)` → `path.join(staticRoot, filePath)`
- Changed `startsWith(__dirname)` → `startsWith(staticRoot)` for consistent traversal protection

## Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Static file base path changed from `__dirname` to `staticRoot` (active symlink) |

## Verification

- 16/16 TDD tests pass (`viz/viz-v0022-rebuild-from-v0017.test.ts`)
- 84/84 tests pass across all 5 task test files
- AC-SERVE1: Static base uses active/ symlink ✓
- AC-SERVE3: Traversal protection uses consistent base ✓
