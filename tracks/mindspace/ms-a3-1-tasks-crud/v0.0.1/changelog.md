# Changelog: ms-a3-1-tasks-crud

## v0.0.1 — Initial Design

- PDSA design for tasks table + basic CRUD
- Migration: tasks table with status CHECK constraint (10 states), current_role, claimed_by, feature_flag_name
- CRUD router nested under projects at /:slug/tasks with mergeParams
- Access control: viewer (read), contributor (create/update), admin (delete)
- PUT does NOT allow status changes (reserved for state machine ms-a3-2)
- 3 files: migration (NEW), tasks.ts (NEW), projects.ts (UPDATE)
- 17 test cases
