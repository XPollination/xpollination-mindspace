# PDSA: Capability Detail Crash Fix — Implementation

**Task:** `viz-capability-detail-crash`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent

---

## Implementation

### Root Cause

`GET /api/capabilities/:capId` JOINs `capability_requirements → requirements`. When `requirements` table doesn't exist, `SqliteError` is thrown inside the inner try block. The catch swallows it silently, skipping the `sendJson()` call, causing fallthrough to 404.

### Fix

Wrapped the requirements query in its own try/catch, defaulting to empty array `[]` on error. The main capability query and tasks query remain in the outer try block.

### Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Requirements query wrapped in own try/catch |
| `viz/versions/v0.0.24/server.js` | Same fix |
| `viz/versions/v0.0.24/changelog.json` | Version metadata |
| `viz/active` | Symlink → versions/v0.0.24 |

## Verification

- 6/6 TDD tests pass (`viz/viz-capability-detail-crash.test.ts`)
