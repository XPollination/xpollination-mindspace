# Changelog: ms-a2-3-access-middleware v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Factory pattern: `requireProjectAccess(minRole)` returns middleware
- Role hierarchy via numeric levels: viewer=0, contributor=1, admin=2
- Checks project existence (404) before access check (403)
- Attaches `req.projectAccess = { role, projectSlug }` for downstream
- Separate from `requireApiKeyOrJwt` — auth (identity) vs authz (permissions)
- 1 file: require-project-access.ts (NEW)
- 15 test cases
