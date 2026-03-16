# PDSA: Workflow Hard Gate — Force PDSA Before Dev/QA

**Task:** ms-wf-hard-gate-pdsa-start
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.14 Phase 1

## Problem

Currently `pending->ready` sets `newRole:pdsa` (soft redirect) but nothing BLOCKS dev/qa from claiming a task that skipped PDSA. Need a hard gate: reject `ready->active:dev` and `ready->active:qa` if no PDSA work happened.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add `pdsa_ref` to `requiresDna` for `ready->active:dev` transition | Uses existing `validateDnaRequirements()` infrastructure — zero architectural change |
| D2 | Add `pdsa_ref` to `requiresDna` for `ready->active:qa` (approved->active:qa) | QA also needs PDSA design to write tests against |
| D3 | Bug type keeps NO pdsa_ref requirement | Bugs bypass PDSA by design (existing pattern) |
| D4 | Implementation on develop branch | DNA specifies develop as target; DEV environment (4201) |
| D5 | Update WORKFLOW.md to document the hard gate rule | Process documentation must match engine behavior |

### Acceptance Criteria

- AC1: `ready->active:dev` for task type requires `pdsa_ref` in DNA (rejects without it)
- AC2: `approved->active:qa` for task type requires `pdsa_ref` in DNA
- AC3: Bug type transitions are unchanged (no pdsa_ref requirement)
- AC4: Error message clearly states what's missing
- AC5: WORKFLOW.md updated with hard gate documentation
- AC6: Tests prove gate works (block without pdsa_ref, allow with it)

### Files to Change

- `src/db/workflow-engine.js` — Add `pdsa_ref` to `requiresDna` arrays (lines ~42-43)
- `tracks/process/context/WORKFLOW.md` — Document hard gate rule
- Tests: verify gate blocks and allows correctly

### Test Plan

1. Attempt `ready->active:dev` without `pdsa_ref` → should fail with clear error
2. Attempt `ready->active:dev` with `pdsa_ref` → should succeed
3. Attempt bug type `ready->active:dev` without `pdsa_ref` → should succeed (bug exception)
4. Verify existing transitions still work

## Do

(Implementation by DEV agent on develop branch)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
