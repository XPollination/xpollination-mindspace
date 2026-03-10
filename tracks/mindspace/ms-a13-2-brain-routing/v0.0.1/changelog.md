# Changelog: ms-a13-2-brain-routing v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Routing logic in mindspace API (brain-router.ts), not in brain API
- `resolveCollections()` pure function: read → [org, public], write → [org]
- Proxy to brain API at :3200 with `collection` parameter
- Read merges results from all collections, sorted by score
- Write is org-only (F17 gate prevents direct public writes)
- F17 gate mechanism deferred to future task (needs approval workflow)
- 2 files: brain-router.ts (NEW), brain.ts (UPDATE)
- 16 test cases
