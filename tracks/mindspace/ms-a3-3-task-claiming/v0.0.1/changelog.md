# Changelog: ms-a3-3-task-claiming

## v0.0.1 — Initial Design

- PDSA design for task claiming endpoint
- POST /api/projects/:slug/tasks/:taskId/claim — claim with agent_id + role
- DELETE /api/projects/:slug/tasks/:taskId/claim — release claim
- Validates: ready status, unclaimed, role match, no blocked deps, agent exists
- Atomic claim + ready→active transition
- 2 files: task-claiming.ts (NEW), tasks.ts (UPDATE)
- 12 test cases
