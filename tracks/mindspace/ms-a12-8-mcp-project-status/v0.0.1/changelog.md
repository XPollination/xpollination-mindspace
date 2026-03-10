# Changelog: ms-a12-8-mcp-project-status v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Tool name: mindspace_get_project_status
- Requires project_slug parameter
- Calls GET /api/projects/:slug + GET /api/projects/:slug/members
- Progressive enhancement: returns what's available, degrades gracefully for missing endpoints
- Reuses HTTP client pattern from ms-a12-1 (fetch, X-API-Key, MINDSPACE_API_URL)
- Helper function apiGet() for DRY API calls
- 2 files: tool definition (NEW), tools/index.ts (UPDATE)
- 12 test cases
