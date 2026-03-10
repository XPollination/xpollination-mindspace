# Changelog: ms-a7-5-agent-pool v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Separate `agent-pool.ts` router, nested under projects at `/:slug/agents`
- Aggregation: `by_role` (counts per role), `by_status` (counts per status)
- Disconnected agents excluded by default, `?include_disconnected=true` to include
- `current_task: null` placeholder for future lease/task integration
- Capabilities parsed from JSON string to array in response
- 2 files: agent-pool.ts (NEW), projects.ts (UPDATE)
- 14 test cases
