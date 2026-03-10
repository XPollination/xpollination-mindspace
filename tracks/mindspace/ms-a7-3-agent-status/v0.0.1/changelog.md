# Changelog: ms-a7-3-agent-status v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Heartbeat endpoint reactivates idle agents, rejects disconnected (must re-register)
- Status sweep via setInterval (60s), thresholds configurable via env
- active → idle at 5min, idle → disconnected at 30min (no direct active → disconnected)
- disconnected_at timestamp set on disconnect transition
- PATCH /status for graceful disconnect
- 3 files: agents.ts (UPDATE), agent-status-sweep.ts (NEW), server.ts (UPDATE)
- 16 test cases
