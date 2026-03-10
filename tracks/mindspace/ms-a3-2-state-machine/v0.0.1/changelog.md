# Changelog: ms-a3-2-state-machine

## v0.0.1 — Initial Design

- PDSA design for task state machine
- Migration 013: task_transitions history table (from_status, to_status, actor)
- Service: validateTransition() + computeNewRole() with full transition map
- POST /:taskId/transition endpoint with validation, role computation, history recording
- Review chain: review→review with role changes (qa→pdsa→liaison)
- Rework flow: requires rework_target_role, exit preserves role
- Blocked flow: requires blocked_reason, any state can block
- 4 files: migration (NEW), task-state-machine.ts (NEW), task-transitions.ts (NEW), tasks.ts (UPDATE)
- 20 test cases
