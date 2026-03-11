# Changelog: ms-a8-3-auto-unblock

## v0.0.1 — Initial Design

- PDSA design for blocked status computation + auto-unblock
- isTaskBlocked service: checks incomplete dependencies
- autoUnblockDependents: triggered on complete transition, transitions blocked→ready
- 2 files: blocked-status.ts (NEW), task-transitions.ts (UPDATE)
- 10 test cases
