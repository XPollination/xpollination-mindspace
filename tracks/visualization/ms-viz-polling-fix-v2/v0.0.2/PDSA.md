# PDSA: ETag/304 Conditional Polling — Rework

**Task:** `ms-viz-polling-fix-v2`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent (rework)

---

## Rework Context

**Rework reason:** VERSIONING VIOLATION — Viz changes edited root files in-place instead of creating a new version directory.

**Root cause:** Implementation modified `viz/server.js` and `viz/index.html` directly instead of creating `viz/versions/v0.0.13/` with the changes.

## Fix

1. Create `viz/versions/v0.0.13/` with `server.js`, `index.html`, `changelog.json`
2. Version contains ETag/304 conditional polling changes (crypto MD5, If-None-Match, 304 response)
3. Update `viz/active` symlink to latest version (v0.0.15, cumulative with all tasks)

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.13/server.js` | ETag generation via MD5, If-None-Match handling, 304 response, Cache-Control: no-cache |
| `viz/versions/v0.0.13/index.html` | lastEtag variable, If-None-Match header in pollData(), 304 handling |
| `viz/versions/v0.0.13/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.15 |
