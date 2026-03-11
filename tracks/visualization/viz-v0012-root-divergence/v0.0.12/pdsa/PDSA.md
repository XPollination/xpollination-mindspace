# PDSA: Viz v0.0.12 — Resolve Root/Versioned File Divergence

**Date:** 2026-03-11
**Task:** ms-viz-v0012-root-divergence
**Track:** visualization
**Status:** PLAN

## Plan

### Problem

LIAISON reactively edited root `viz/server.js` and `viz/index.html` on 2026-03-11 (role violation). These changes work but are NOT in `viz/versions/v0.0.11/`. The TEST service (port 4200) runs from root `viz/server.js`, creating a divergence between root and versioned files. Version display in the UI is broken.

### Root Cause

Root files were edited directly instead of creating a new version. The versioning system expects changes to go through `viz/versions/v0.0.X/`, with `viz/active` symlink pointing to the current version. Root files and versioned files are now out of sync.

### Changes in Root Files (to incorporate into v0.0.12)

**viz/server.js:**
1. Line 480: `const BIND_HOST = process.env.VIZ_BIND || '0.0.0.0';`
2. Line 481: `server.listen(PORT, BIND_HOST, () => {` (was `server.listen(PORT, () => {`)
3. Line 483: Uses `__dirname` (was undefined `WORKSPACE_PATH`)

**viz/index.html:**
1. Line 887: `<option value="auto-approval">Auto-Approval</option>` (auto-approval mode in dropdown)

### Design

1. Copy `viz/versions/v0.0.11/` to `viz/versions/v0.0.12/`
2. Apply the 3 server.js changes and 1 index.html change to v0.0.12
3. Diagnose and fix the version display bug in the UI
4. Update `viz/active` symlink to point to `versions/v0.0.12`
5. Ensure root `viz/server.js` and `viz/versions/v0.0.12/server.js` match
6. Restart mindspace-test.service, verify version displays correctly

### NOT Changed
- No new features beyond incorporating existing root fixes
- No changes to API endpoints
- PROD (4100) deployment is separate decision

## Do
(To be completed by DEV agent)

## Study
- `curl http://localhost:4200/api/version` returns `{"version":"v0.0.12"}`
- Version info displays in the UI header
- Auto-approval mode still works in dropdown
- VIZ_BIND host binding still works

## Act
- If version display still broken, investigate frontend JS that calls /api/version
- Establish rule: never edit root viz files directly, always create new version
