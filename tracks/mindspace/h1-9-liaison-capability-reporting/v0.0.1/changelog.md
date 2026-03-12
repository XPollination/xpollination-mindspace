# Changelog: h1-9-liaison-capability-reporting v0.0.1

## v0.0.1 — 2026-03-12

Initial implementation.

### Changes
- New capability-status CLI command in interface-cli.js
- Queries capabilities with mission join, computes progress from linked tasks
- Returns JSON with per-capability progress_percent, task_count, complete_count
- Handles missing capabilities table gracefully (returns empty array)

### Tests
- 2/2 passing (api/__tests__/h1-9-liaison-capability-reporting.test.ts)
