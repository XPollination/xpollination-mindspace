# Changelog: ms-a4-1-requirements-crud

## v0.0.1 — Initial Design

- PDSA design for requirements table + CRUD
- Migration: requirements table with status (draft/active/deprecated), priority (low/medium/high/critical), UNIQUE(project_slug, req_id_human)
- CRUD router nested under projects at /:slug/requirements
- GET supports both UUID and req_id_human lookup
- No DELETE endpoint — requirements are deprecated for traceability
- Access: viewer (read), contributor (create/update)
- 3 files: migration (NEW), requirements.ts (NEW), projects.ts (UPDATE)
- 16 test cases
