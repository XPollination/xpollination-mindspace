# Changelog: ms-a2-1-projects-crud v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Migration 006-projects.sql: id UUID, slug UNIQUE, name, description, created_at, created_by FK
- Slug validation regex: lowercase alphanumeric + hyphens, 2-50 chars
- Routes file projects.ts with POST/GET/GET/:slug/PUT/:slug
- All endpoints behind requireApiKeyOrJwt middleware
- Slug-based lookups (not id) for human-readable URLs
- No DELETE endpoint (not in requirements)
- No pagination for MVP
- created_by set from req.user.id, immutable
- 3 files: migration (NEW), routes (NEW), server.ts (UPDATE)
- 20 test cases
