# Changelog: ms-a7-4-role-switching v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Added to existing agents.ts (not a separate file)
- `from_role` optional safety assertion (409 on mismatch)
- Capabilities validation: `to_role` must be in capabilities (if non-empty)
- Disconnected agents can't switch (409), must re-register
- No-op for same role: returns `switched: false`
- No direct brain call — caller logs with returned `previous_role` + `reason`
- Future lease release via comment placeholder
- 1 file: agents.ts (UPDATE)
- 15 test cases
