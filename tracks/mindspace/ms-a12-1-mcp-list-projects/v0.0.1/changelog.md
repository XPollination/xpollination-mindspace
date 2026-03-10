# Changelog: ms-a12-1-mcp-list-projects v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Tool name: mindspace_list_projects (mindspace_ prefix for API-backed tools)
- HTTP client using native fetch() — calls GET /api/projects
- Auth via MINDSPACE_API_KEY env var → X-API-Key header
- API URL via MINDSPACE_API_URL env var, defaults to http://localhost:3100
- No input parameters (list all projects)
- New category: src/tools/mindspace/
- 2 files: tool definition (NEW), tools/index.ts (UPDATE)
- 12 test cases
