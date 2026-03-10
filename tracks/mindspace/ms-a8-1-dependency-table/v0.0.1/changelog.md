# Changelog: ms-a8-1-dependency-table

## v0.0.1 — Initial Design

- PDSA design for dependency table
- Migration 014: task_dependencies with UNIQUE, self-dep CHECK, ON DELETE CASCADE
- Forward deps: GET /:taskId/dependencies (what blocks me)
- Reverse deps: GET /:taskId/dependents (what I block)
- Add/remove: POST + DELETE with same-project validation
- Incorporates liaison design input: reverse index, downstream visibility
- 3 files: migration (NEW), task-dependencies.ts (NEW), tasks.ts (UPDATE)
- 16 test cases
