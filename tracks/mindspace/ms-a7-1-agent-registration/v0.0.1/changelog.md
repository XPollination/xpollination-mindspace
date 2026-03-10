# Changelog: ms-a7-1-agent-registration v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Migration 008-agents.sql: id UUID, user_id FK→users, name, current_role, capabilities (JSON TEXT), project_slug FK→projects, session_id, status, connected_at, last_seen, disconnected_at
- Roles: pdsa, dev, qa, liaison, orchestrator
- Status: active, idle, disconnected (active on register)
- Re-registration updates existing non-disconnected agent (same user+name+project)
- capabilities stored as JSON array in TEXT column
- project_slug optional (nullable FK)
- GET supports filters: project_slug, status
- 3 files: migration (NEW), routes (NEW), server.ts (UPDATE)
- 24 test cases
