# PDSA: Workflow engine — role consistency enforcement on transitions

**Task:** workflow-complete-role-reset
**Version:** v0.0.4 (rework of v0.0.3)
**Author:** PDSA agent
**Date:** 2026-03-10

## Rework Context

v0.0.3 was rejected because the investigation only compared .js files and missed the tracks/documentation structure drift. Thomas's feedback (verbatim):

> "REWORK — PDSA INVESTIGATION WAS INCOMPLETE. PDSA only compared .js engine files and declared 0 diff. But the WORKFLOW.md tracks structure has drifted between main and develop [...] Both PROD (4100) and TEST (4200) run the same workflow engine against the SAME production DB. The workflow is LIVE INFRASTRUCTURE, not a develop-only feature. Therefore: (A) Reconcile workflow tracks between main and develop FIRST — document what goes where. (B) The enforcement fix MUST land on main because PROD uses the workflow engine live. Work on main, not develop-only. (C) Document the reconciliation as part of this task."

## Full Branch Drift Investigation

### Engine code (.js files): IDENTICAL

```
workflow-engine.js:  0 diff (main = develop)
interface-cli.js:    0 diff (main = develop)
agent-keys.js:       0 diff (main = develop)
```

### WORKFLOW.md: Content identical, location differs

| Aspect | main | develop |
|--------|------|---------|
| Version dir | `tracks/process/context/workflow/v16/` | `tracks/process/context/workflow/v0.0.16/` |
| Symlink | `tracks/process/context/WORKFLOW.md → workflow/v16/WORKFLOW.md` | **No symlink** |
| CLAUDE.md ref | `docs/WORKFLOW.md (v12)` (stale) | `tracks/process/context/workflow/v0.0.16/WORKFLOW.md` (correct) |

**Issue:** Main has a convenience symlink, develop does not. Both have the same content but different version naming conventions (`v16` vs `v0.0.16`). Main's CLAUDE.md has a stale reference to `docs/WORKFLOW.md (v12)`.

### Tracks only on develop (not on main)

These are PDSA docs and changelogs created on develop by the PDSA agent:

- `tracks/mindspace/` — all ms-a0-* and ms-a11-* PDSA designs (this session's work)
- `tracks/process/workflow-complete-role-reset/` — v0.0.1, v0.0.2, v0.0.3 of this task
- `tracks/process/workflow-md-versioning/v0.0.2/` — rework changelog
- `tracks/process/pm-status-branch-versioning-checks/` — v0.0.1 through v0.0.7
- `tracks/process/viz-*` — viz PDSA docs
- `tracks/process/t1-*` — traceability PDSAs
- `tracks/process/ms-a0-1-express-setup/` — Express setup PDSA
- `tracks/process/cleanup-test-qdrant-collections/` — operational task

### Tracks only on main (not on develop)

Nothing — all of main's tracks are also on develop (plus develop has more).

### CLAUDE.md differences

| Field | main | develop |
|-------|------|---------|
| Workflow source of truth | `docs/WORKFLOW.md (v12)` (stale!) | `tracks/process/context/workflow/v0.0.16/WORKFLOW.md` (correct) |
| Everything else | identical | identical |

## Reconciliation Plan

### Step 1: Fix on main (enforcement is live infrastructure)

The enforcement fix must land on **main** because both PROD (4100) and TEST (4200) run the same workflow engine against the production DB.

**Files to modify on main:**

1. `src/db/workflow-engine.js` — add `EXPECTED_ROLES_BY_STATE` + `validateRoleConsistency()` + `newRole: 'liaison'` on `any->cancelled:system`
2. `src/db/interface-cli.js` — add enforcement gate + import update
3. `src/db/migrations/v17-complete-role-reset.js` — new cleanup migration
4. `tracks/process/context/WORKFLOW.md` — update symlink target after creating v17 dir
5. `CLAUDE.md` — fix stale workflow reference from `docs/WORKFLOW.md (v12)` to correct path

### Step 2: WORKFLOW.md version naming reconciliation

The `v16` vs `v0.0.16` naming drift was introduced by the `workflow-md-versioning` task. The convention on develop is `v0.0.X`. For the v17 version:

- **On main:** Create `tracks/process/context/workflow/v17/WORKFLOW.md` (matching main's existing `v16` pattern) and update symlink
- **On develop:** After merging main's changes, the v17 dir will use main's convention. The `v0.0.16` stays as-is (historical).

### Step 3: Merge main → develop

After the enforcement fix lands on main, merge main into develop to synchronize. This brings:
- The enforcement code
- The v17 WORKFLOW.md
- The updated CLAUDE.md

## Design (unchanged from v0.0.2/v0.0.3)

### Change A: Role consistency map in workflow-engine.js

```javascript
export const EXPECTED_ROLES_BY_STATE = {
  'complete': 'liaison',
  'approval': 'liaison',
  'approved': 'qa',
  'testing': 'qa',
  'cancelled': 'liaison'
};

export function validateRoleConsistency(targetStatus, effectiveRole) {
  const expected = EXPECTED_ROLES_BY_STATE[targetStatus];
  if (!expected) return null;
  if (effectiveRole === expected) return null;
  return `Role consistency violation: ${targetStatus} requires role=${expected} (per WORKFLOW.md), but transition would set role=${effectiveRole || 'null'}. Fix the transition rule to include newRole: '${expected}', or check rework_target_role configuration.`;
}
```

### Change B: Enforcement gate in interface-cli.js cmdTransition

```javascript
const effectiveRole = newRole || currentRole;
const consistencyError = validateRoleConsistency(newStatus, effectiveRole);
if (consistencyError) {
  db.close();
  error(consistencyError);
}
```

### Change C: `any->cancelled:system` explicit newRole

Add `newRole: 'liaison'` to `any->cancelled:system` in ALLOWED_TRANSITIONS (task + bug).

### Change D: Cleanup migration

`src/db/migrations/v17-complete-role-reset.js` — one-time fix for 69 historical tasks.

### Change E: WORKFLOW.md v17

Create `tracks/process/context/workflow/v17/WORKFLOW.md`. Update symlink on main. Add changelog:

```
| 2026-03-10 | v17 Role consistency enforcement: engine REJECTS transitions producing wrong role for fixed-role states. One-time migration fixes 69 historical complete tasks. Tracks structure reconciled between main and develop | PDSA |
```

### Change F: CLAUDE.md fix

Update main's CLAUDE.md workflow reference from `docs/WORKFLOW.md (v12)` to `tracks/process/context/WORKFLOW.md` (symlink, always points to latest).

## Files Changed (on main branch)

1. `src/db/workflow-engine.js` — `EXPECTED_ROLES_BY_STATE` + `validateRoleConsistency()` + `any->cancelled:system` newRole
2. `src/db/interface-cli.js` — enforcement gate + import
3. `src/db/migrations/v17-complete-role-reset.js` — new cleanup script
4. `tracks/process/context/workflow/v17/WORKFLOW.md` — new version
5. `tracks/process/context/WORKFLOW.md` — update symlink to v17
6. `CLAUDE.md` — fix stale workflow reference

## Testing

1. Enforcement rejects wrong role on fixed-role states
2. Enforcement allows correct role on all standard transitions
3. Variable-role states (active, review, ready, rework) are not checked
4. `any->cancelled:system` sets role=liaison
5. Migration fixes historical data
6. WORKFLOW.md v17 exists with changelog
7. CLAUDE.md points to correct WORKFLOW.md path
8. Symlink `tracks/process/context/WORKFLOW.md` resolves to v17
9. After merge to develop, both branches have consistent workflow infrastructure
