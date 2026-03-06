# PDSA: Fix review+liaison→rework role routing

**Task:** rework-liaison-role-routing
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

When LIAISON reworks a task from `review+liaison`, the engine (interface-cli.js:618-619) only routes to two targets:
- `pdsa` (if `dna.pdsa_ref` exists)
- `liaison` (fallback)

This misses `dev` — the most common rework target when the implementation is wrong but the design is fine. Evidence: `viz-complete-sort-regression` was routed to `rework+liaison` instead of `rework+dev`.

Per WORKFLOW.md rework entry table:
- liaison → pdsa: "liaison catches issue (autonomous)" — design problem
- qa → dev: "QA finds test issues" — implementation problem
- pdsa → dev: "PDSA finds design mismatch" — implementation problem

Missing: liaison → dev (implementation problem caught at final review).

## Root Cause

`workflow-engine.js` line 87 defines `review->rework:liaison` with NO `newRole`:
```javascript
'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', clearsDna: [...] }
```

The override in `interface-cli.js` line 618-619 uses `pdsa_ref` as a binary heuristic:
```javascript
newRole = dna.pdsa_ref ? 'pdsa' : 'liaison';
```

This can't distinguish "design problem" from "implementation problem" — both have `pdsa_ref`.

## Design

### Change A: Require `rework_target_role` for liaison rework (interface-cli.js)

Replace the binary heuristic (lines 618-619) with explicit role specification:

```javascript
if (fromStatus === 'review' && newStatus === 'rework' && currentRole === 'liaison') {
  if (!dna.rework_target_role) {
    error('review+liaison→rework requires dna.rework_target_role. Set it before transitioning. Valid: pdsa, dev, qa, liaison');
  }
  if (!VALID_ROLES.includes(dna.rework_target_role)) {
    error(`Invalid rework_target_role: ${dna.rework_target_role}. Valid: ${VALID_ROLES.join(', ')}`);
  }
  newRole = dna.rework_target_role;
}
```

This makes the same pattern as `complete->rework` (line 622-629), which already requires `rework_target_role`.

### Change B: Add `rework_target_role` to requiresDna in workflow-engine.js

Update the `review->rework:liaison` transition rule:

```javascript
'review->rework:liaison': {
  allowedActors: ['liaison'],
  requireRole: 'liaison',
  clearsDna: ['memory_query_session', 'memory_contribution_id'],
  requiresDna: ['rework_target_role']
}
```

### Change C: WORKFLOW.md update (documentation)

Add a note to the rework entry table clarifying that `review+liaison→rework` requires `rework_target_role` in DNA:

> **LIAISON rework routing:** When LIAISON sends a task to rework from `review+liaison`, `dna.rework_target_role` must be set to indicate the correct re-entry point (pdsa, dev, qa, or liaison).

### Files Changed

1. `src/db/interface-cli.js` — lines 615-620: replace binary heuristic with rework_target_role check
2. `src/db/workflow-engine.js` — line 87: add `requiresDna: ['rework_target_role']`
3. `tracks/process/context/WORKFLOW.md` — add liaison rework routing note

### Testing

1. Transition `review+liaison→rework` WITHOUT `rework_target_role` → should fail with error
2. Transition `review+liaison→rework` WITH `rework_target_role: 'dev'` → should succeed, role=dev
3. Transition `review+liaison→rework` WITH `rework_target_role: 'pdsa'` → should succeed, role=pdsa
4. Transition `review+liaison→rework` WITH `rework_target_role: 'invalid'` → should fail
5. Existing `complete->rework` with `rework_target_role` → unchanged behavior
