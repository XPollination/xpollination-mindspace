# Changelog: ms-a2-2-project-access v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Migration 007-project-access.sql: id UUID, user_id FK→users, project_slug FK→projects(slug), role, granted_at, granted_by FK→users
- UNIQUE(user_id, project_slug) prevents duplicate memberships
- Roles: admin/contributor/viewer, validated in handler, default 'viewer'
- Routes: POST/GET/DELETE /api/projects/:slug/members with mergeParams
- DELETE by userId path param, not body
- No authorization enforcement (deferred to ms-a2-3)
- No auto-admin on project creation (separate concern)
- 3 files: migration (NEW), routes (NEW), server.ts (UPDATE)
- 24 test cases
