# Completion Abstract: research-task-completion-transition

**Date:** 2026-03-02
**Status:** Complete
**Project:** xpollination-mcp-server

## Outcome

Added `approval→complete` transition to workflow engine for task type. Research tasks that produce sub-tasks can now be completed directly by LIAISON after approval, without routing through QA.

## Key Decisions

- **LIAISON-only:** Only liaison actor can execute approval→complete (same as other human-decision transitions).
- **Same gates as review→complete:** requiresHumanConfirm + abstract_ref in DNA.
- **Bug type excluded:** Bugs have no approval state, so no approval→complete needed.
- **Existing path preserved:** approval→approved remains unchanged for tasks needing QA testing.

## Changes

- `src/db/workflow-engine.js`: Added approval→complete rule (line 53) with allowedActors liaison, requiresHumanConfirm true, requiresDna abstract_ref, newRole liaison
- `tracks/process/context/WORKFLOW.md`: Updated to v15 with Quality Gates table entry
- Commit: 2956df5

## Test Results

- 9/9 tests pass
- QA PASS, PDSA PASS

## Related Documentation

- PDSA: [2026-03-02-research-task-completion-transition.pdsa.md](../pdsa/2026-03-02-research-task-completion-transition.pdsa.md)
- Incident: multi-user-brain-research stuck at active+qa (cancelled via system actor)
