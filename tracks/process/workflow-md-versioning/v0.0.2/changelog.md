# workflow-md-versioning v0.0.2 — Rework

## Rework Reason
Two issues from liaison review: (1) Symlink should be removed, not kept — no duplicates. (2) Version directory should use v0.0.x format, not v16.

## Changes
1. Renamed `workflow/v16/` to `workflow/v0.0.16/` (versioning pattern compliance)
2. Deleted symlink at `tracks/process/context/WORKFLOW.md` (no duplicates)
3. Updated CLAUDE.md reference to `tracks/process/context/workflow/v0.0.16/WORKFLOW.md`
4. Updated README.md references (3 occurrences)
5. Updated monitor SKILL.md and pm.status SKILL.md references

## Commits
- `11d0f8c` (develop, xpollination-mcp-server) — refactor: rework workflow-md-versioning
- `cc37dbf` (main, xpollination-best-practices) — docs: update WORKFLOW.md references

## Note
QA tests at `viz/workflow-md-versioning.test.ts` need updating: remove symlink assertions, change v16 to v0.0.16, add test that old symlink path does NOT exist.
