# Changelog: brain-query-echo-leak v0.0.1

## v0.0.1 — 2026-03-10

Initial investigation and design.

### Investigation findings

- Brain API `read_only` enforcement at API level is WORKING (line 199 in memory.ts)
- Previous fix `brain-pollution-read-only` deployed 2026-02-27 — API-level fix is intact
- All hook scripts correctly pass `read_only: true`
- Leak source: agents reconstructing curl commands without `read_only` (LLM interpretation of templates)
- Evidence: 5+ duplicate entries of recovery query strings stored as thoughts (category: noise/state_snapshot)

### Proposed changes

1. **Server-side query pattern detection** — auto-force read_only for known recovery query patterns
2. **Brain skill verification** — ensure `/brain query` always passes read_only:true
3. **One-time cleanup** — delete existing noise entries from Qdrant
