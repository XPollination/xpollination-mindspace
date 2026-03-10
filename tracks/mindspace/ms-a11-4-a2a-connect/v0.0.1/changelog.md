# Changelog: ms-a11-4-a2a-connect v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Separate `a2a-connect.ts` router (A2A protocol, not REST CRUD)
- API key from twin body `identity.api_key`, not header
- Inline registration logic (same SQL as agents.ts /register)
- WELCOME response with agent_id, session_id, endpoints (stream, heartbeat, disconnect)
- A2A message types: WELCOME (success), ERROR (failure)
- Project access required (403 if not member)
- No auto-SSE: WELCOME returns stream URL, agent connects separately
- 2 files: a2a-connect.ts (NEW), server.ts (UPDATE)
- 17 test cases
