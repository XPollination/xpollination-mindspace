# Changelog: ms-a5-1-focus-crud

## v0.0.1 — Initial Design

- PDSA design for focus table + CRUD
- Migration 016: project_focus with UNIQUE(project_slug), scope, task_ids JSON
- GET/PUT/DELETE endpoints, admin-only for set/clear
- Singleton per project (upsert on PUT)
- 3 files: migration (NEW), focus.ts (NEW), projects.ts (UPDATE)
- 12 test cases
