# PDSA: Workflow engine — role consistency enforcement on transitions

**Task:** workflow-complete-role-reset
**Version:** v0.0.5 (rework of v0.0.4)
**Author:** PDSA agent
**Date:** 2026-03-10

## Rework Context

v0.0.4 was rejected because the implementation created `v17/` on main, perpetuating the old naming convention. Develop already established `v0.0.X` convention (via workflow-md-versioning task). Thomas's feedback (verbatim):

> "REWORK — VERSIONING CONVENTION VIOLATION. The implementation created v17/ on main, but the correct convention is v0.0.X (already established on develop by the workflow-md-versioning task). REQUIRED FIX: (1) Rename v17/ to v0.0.17/ on main. [...] (4) The goal: main goes from v16/ directly to v0.0.17/ (skipping v0.0.16 on main since the content is identical, just adopting the corrected naming going forward). After merge, develop will have v0.0.16/ (historical) and v0.0.17/ (new enforcement) — both in correct v0.0.X format. CLEAR INSTRUCTION: Do NOT touch workflow version directories on develop. Only modify main: rename v17→v0.0.17, update symlink."

## What Changed from v0.0.4

**Only the workflow version directory naming.** All enforcement code (EXPECTED_ROLES_BY_STATE, validateRoleConsistency, interface-cli.js gate, cancelled newRole, migration) is already implemented and passing 19/19 tests (commit 8b47c63 on main). This rework is a naming-only fix.

| v0.0.4 (rejected) | v0.0.5 (this version) |
|--------------------|-----------------------|
| `workflow/v17/WORKFLOW.md` | `workflow/v0.0.17/WORKFLOW.md` |
| Symlink → `workflow/v17/WORKFLOW.md` | Symlink → `workflow/v0.0.17/WORKFLOW.md` |
| Perpetuated old `vN` convention | Adopts `v0.0.X` convention from develop |

## Scope of Fix (on main only)

1. **Rename** `tracks/process/context/workflow/v17/` → `tracks/process/context/workflow/v0.0.17/`
2. **Update symlink** `tracks/process/context/WORKFLOW.md` → `workflow/v0.0.17/WORKFLOW.md`
3. **Do NOT touch develop** — develop already has `v0.0.16/` in correct format. After main→develop merge, develop gets `v0.0.17/` naturally.

## Design (unchanged from v0.0.4 except naming)

All enforcement logic from v0.0.4 remains. See v0.0.4 PDSA for full design details:

- **Change A:** `EXPECTED_ROLES_BY_STATE` map in workflow-engine.js (complete/approval→liaison, approved/testing→qa, cancelled→liaison)
- **Change B:** `validateRoleConsistency()` enforcement gate in interface-cli.js
- **Change C:** `any->cancelled:system` explicit `newRole: 'liaison'`
- **Change D:** Cleanup migration `v17-complete-role-reset.js`
- **Change E:** WORKFLOW.md in `v0.0.17/` (renamed from v17/)
- **Change F:** CLAUDE.md fix (stale v12 ref → symlink path)

## Files Changed (on main branch)

Only 2 files change from v0.0.4's implementation:

1. `tracks/process/context/workflow/v0.0.17/WORKFLOW.md` — renamed from v17/ (content unchanged)
2. `tracks/process/context/WORKFLOW.md` — symlink updated to `workflow/v0.0.17/WORKFLOW.md`

The old `v17/` directory is deleted.

## Testing

Same 19 tests as v0.0.4 plus:

1. Symlink resolves to `v0.0.17/WORKFLOW.md` (not v17/)
2. No `v17/` directory exists after fix
3. After main→develop merge, develop has both `v0.0.16/` and `v0.0.17/` — both in `v0.0.X` format
