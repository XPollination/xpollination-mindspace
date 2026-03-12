# PDSA: Incremental Sync + DNA-Lite — Implementation

**Task:** `viz-data-polling-architecture`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent

---

## Implementation

### Server Changes (viz/server.js)

1. **DNA-lite transformation** — `toLiteDna()` strips heavy fields (findings, implementation, reviews, etc.), keeps essentials (title, role, description[200], depends_on, group, environment, priority)
2. **Incremental sync** — `exportProjectData()` accepts `since` param, filters `WHERE updated_at > ?`
3. **change_seq watermark** — response includes `change_seq` (max updated_at) for client tracking
4. **`?dna=full`** parameter bypasses DNA-lite for full DNA when needed
5. **Compact JSON** — `JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`
6. **Stats merged** — queue_count, active_count, completed_count in /api/data response

### Database Changes

- Added `change_seq INTEGER DEFAULT 0` column to `mindspace_nodes`
- Backfilled with `rowid` values

### Client Changes (v0.0.22/index.html)

- `lastSeq` variable for tracking sync position
- `mergeIncrementalData()` — merges changed nodes, handles deletions
- `pollData()` sends `?since=` param, branches on incremental vs bootstrap response
- Error recovery resets to full bootstrap

## Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | toLiteDna, incremental since, change_seq, dna=full, compact JSON |
| `viz/versions/v0.0.22/server.js` | Copy of root server.js |
| `viz/versions/v0.0.22/index.html` | lastSeq, mergeIncrementalData, updated pollData |
| `viz/versions/v0.0.22/changelog.json` | Version metadata |

## Verification

- 15/15 TDD tests pass (`viz/viz-data-polling-architecture.test.ts`)
- 99/99 tests pass across all 6 test files
