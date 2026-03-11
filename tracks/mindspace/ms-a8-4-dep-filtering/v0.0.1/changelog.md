# Changelog: ms-a8-4-dep-filtering

## v0.0.1 — Initial Design

- PDSA design for dependency-aware task filtering
- Enhances available_only to use task_dependencies table (not just status field)
- Adds blocked_only=true filter for tasks with incomplete dependencies
- Enriches task responses with is_blocked boolean and blocking_tasks array
- 1 file: api/routes/tasks.ts (UPDATE)
- 10 test cases
