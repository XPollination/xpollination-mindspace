# Changelog: ms-a4-3-req-task-linking

## v0.0.1 — Initial Design

- PDSA design for requirement ↔ task linking
- GET /:reqId/tasks on requirements router (bidirectional navigation)
- Enrich task GET with requirement object (req_id_human, title, status)
- No new migration — uses existing requirement_id column on tasks
- 2 files: requirements.ts (UPDATE), tasks.ts (UPDATE)
- 10 test cases
