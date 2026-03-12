# Changelog: ms-viz-polling-optimization v0.0.1

## v0.0.1 — 2026-03-12

Initial implementation.

### Changes
- New /api/data endpoint with ETag via MD5 of task data
- Returns 304 Not Modified when If-None-Match matches current ETag
- Viz v0.0.17: adaptive polling — 5s fast, 30s slow after 6 idle cycles
- Client sends If-None-Match header with cached ETag
- Idle counter resets on data change or tab focus
- Bearer token accepted as API key fallback in api-key-auth.ts

### Tests
- 3/3 passing (api/__tests__/ms-viz-polling-optimization.test.ts)
