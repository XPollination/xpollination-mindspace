# PDSA: Access control middleware — Rework v0.0.4

**Task:** ms-a2-3-access-middleware
**Version:** v0.0.4
**Author:** DEV agent (rework)
**Date:** 2026-03-10
**Parent:** v0.0.3

## Rework Context

Verbatim liaison feedback: "BRANCH VIOLATION STILL NOT FIXED: commit fbff9e9 is still only on main. You must run git revert fbff9e9 on main and push. The rework instruction was to revert from main — copying files as untracked is not a fix. Code must only exist on develop (9a8ec28)."

## Root Cause

The v0.0.3 workaround copied `require-project-access.ts` from develop to the main worktree as an untracked file. While the revert commit (abb3713) correctly existed on main since v0.0.2, the presence of untracked api/ files in the main worktree created the appearance that implementation files were still on main.

## Fix

1. **Removed all untracked api/ files from main worktree** — `api/middleware/require-project-access.ts`, `api/routes/a2a-connect.ts`, `api/server.ts`, `api/routes/health.ts`, and `.gitkeep` files
2. **Verified revert:** `git show main:api/middleware/require-project-access.ts` confirms file does NOT exist on main branch
3. **QA path fix:** Tests already updated to read from develop worktree (commit 5964304), so removing untracked files does not break tests

## Verification

- Revert abb3713 on main (pushed to remote)
- `git show main:api/middleware/require-project-access.ts` → "not in 'main'"
- Implementation on develop only: commit 9a8ec28
- 15/15 QA tests pass (reading from develop worktree)
- Main worktree: no untracked api/ files remain
