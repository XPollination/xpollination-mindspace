# PDSA: ETag/304 Polling Fix v2 — Rework v4 (Develop Base)

**Task:** `ms-viz-polling-fix-v2`
**Version:** v0.0.3
**Date:** 2026-03-12
**Author:** DEV agent (rework4)

---

## Rework Context

**Rework reason:** BASE VERSION WRONG — previous versions built from `main` (v0.0.11) instead of `develop` (v0.0.17).

## Analysis

v0.0.17 on develop ALREADY contains the complete ETag/304 implementation:
- **Client (index.html):** `lastEtag` variable, `If-None-Match` header in `pollData()`, 304 response handling, adaptive polling (5s fast / 30s slow)
- **Server (server.js):** `crypto` import, MD5 ETag generation, `If-None-Match` comparison, 304 responses, `Cache-Control: no-cache` headers

Since v0.0.18 (wf-v18) was built from the v0.0.17 base, it already includes all ETag features. v0.0.19 = v0.0.18 with no additional code changes — just a version bump and changelog.

## Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.19/index.html` | Copied from v0.0.18 (no changes — ETag already present) |
| `viz/versions/v0.0.19/server.js` | Copied from v0.0.18 (no changes — ETag already present) |
| `viz/versions/v0.0.19/changelog.json` | Version metadata |
| `viz/active` | Symlink updated to versions/v0.0.19 |

## Verification

- 14/14 TDD tests pass (`viz/ms-viz-polling-fix-v2.test.ts`)
- All ETag features confirmed present in v0.0.18/v0.0.19 from v0.0.17 base
