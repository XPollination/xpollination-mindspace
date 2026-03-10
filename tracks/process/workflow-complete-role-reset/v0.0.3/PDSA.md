# PDSA: Workflow engine — role consistency enforcement on transitions

**Task:** workflow-complete-role-reset
**Version:** v0.0.3 (rework of v0.0.2)
**Author:** PDSA agent
**Date:** 2026-03-10

## Rework Context

v0.0.2 was sent back for branch drift investigation. Thomas's feedback (verbatim):

> "REWORK AGAIN — BRANCH DRIFT INVESTIGATION REQUIRED. Thomas observed an agent working on the workflow engine in main instead of develop. Before implementing anything: (1) INVESTIGATE: Compare interface-cli.js and workflow-engine.js between main and develop branches. Document any differences — this is the drift. (2) ENSURE: The v0.0.2 enforcement design MUST be built on top of the current latest version in develop, not main. (3) ITERATE VERSION: Plan the implementation as an iteration of the current develop version. If develop has changes that main does not (or vice versa), document the delta. (4) This is a security/alignment loop — we need confidence that the workflow engine is consistent before adding enforcement logic on top of a potentially diverged codebase."

## Branch Drift Investigation

### Method

Ran `git diff main..develop` and `git diff develop..main` on the three core workflow files:

```
git diff main develop -- src/db/workflow-engine.js    → 0 lines diff
git diff main develop -- src/db/interface-cli.js      → 0 lines diff
git diff main develop -- src/db/agent-keys.js         → 0 lines diff
```

### Finding: No drift in workflow engine files

The three core workflow files are **byte-identical** between main and develop. The workflow engine code is consistent across both branches.

### Branch divergence (non-workflow)

| Direction | Commits | Content |
|-----------|---------|---------|
| develop → main (71 files, +8735/-702) | 39 commits | PDSA docs, track dirs, viz features, Express.js setup, config |
| main → develop (71 files, +702/-8735) | 8 commits | TDD test files (.test.ts), PDSA docs |

The divergence is in:
- **PDSA/track documents** — design docs committed to develop
- **Test files** — TDD tests committed to main (likely QA agent working on main instead of develop)
- **Viz features** — version display, port migration on develop
- **Express.js setup** — API scaffold on develop

**None of these affect the workflow engine.** The engine code, transitions, and validation logic are identical on both branches.

### Conclusion

The v0.0.2 enforcement design is safe to implement on develop. No codebase reconciliation needed for the workflow engine. The test files on main should be merged to develop at some point (separate concern, not blocking this task).

## Design (unchanged from v0.0.2)

The v0.0.2 design remains valid since the codebase investigation confirmed no drift. All implementation targets the develop branch worktree (`xpollination-mcp-server-test`).

### Change A: Role consistency map in workflow-engine.js

Add `EXPECTED_ROLES_BY_STATE` constant and `validateRoleConsistency()` function:

```javascript
// States with fixed expected roles (from WORKFLOW.md v16)
// Variable-role states (active, review, ready, rework, pending, blocked) are NOT listed
export const EXPECTED_ROLES_BY_STATE = {
  'complete': 'liaison',
  'approval': 'liaison',
  'approved': 'qa',
  'testing': 'qa',
  'cancelled': 'liaison'
};

/**
 * Validate that the effective role after a transition matches
 * the expected role for the target state.
 *
 * @param {string} targetStatus - The status being transitioned to
 * @param {string|null} effectiveRole - The role that will be set (newRole or currentRole)
 * @returns {string|null} Error message if inconsistent, null if valid
 */
export function validateRoleConsistency(targetStatus, effectiveRole) {
  const expected = EXPECTED_ROLES_BY_STATE[targetStatus];
  if (!expected) return null; // Variable-role state, no check needed
  if (effectiveRole === expected) return null; // Consistent

  return `Role consistency violation: ${targetStatus} requires role=${expected} (per WORKFLOW.md), but transition would set role=${effectiveRole || 'null'}. Fix the transition rule to include newRole: '${expected}', or check rework_target_role configuration.`;
}
```

**Location:** End of workflow-engine.js, after `getHumanConfirmTransitions()`.

### Change B: Enforcement gate in interface-cli.js cmdTransition

After all `newRole` computations (after rework_target_role handling, ~line 667) and before the DNA write (~line 668):

```javascript
// Role consistency enforcement: reject transitions that would produce
// an incorrect role for the target state (WORKFLOW.md fixed-role states)
const effectiveRole = newRole || currentRole;
const consistencyError = validateRoleConsistency(newStatus, effectiveRole);
if (consistencyError) {
  db.close();
  error(consistencyError);
}
```

**Import:** Add `validateRoleConsistency` to the existing import from `./workflow-engine.js`.

### Change C: `any->cancelled:system` explicit newRole

Add `newRole: 'liaison'` to the `any->cancelled:system` rule in ALLOWED_TRANSITIONS (both task and bug types). This makes the rule consistent with the enforcement check.

### Change D: Cleanup migration script

Create `src/db/migrations/v17-complete-role-reset.js` — same as v0.0.2. One-time fix for 69 historical tasks.

### Change E: Workflow version bump v16 → v17

Update `tracks/process/context/WORKFLOW.md` header and changelog.

### Files Changed

1. `src/db/workflow-engine.js` — `EXPECTED_ROLES_BY_STATE` + `validateRoleConsistency()` + `newRole: 'liaison'` on `any->cancelled:system`
2. `src/db/interface-cli.js` — 4-line enforcement gate + import update
3. `src/db/migrations/v17-complete-role-reset.js` — new cleanup script
4. `tracks/process/context/WORKFLOW.md` — version bump + changelog

### Testing

1. Enforcement rejects wrong role: transition rule with `newRole: 'dev'` targeting `complete` is rejected
2. Enforcement allows correct role: `review->complete` (newRole=liaison) succeeds
3. Enforcement allows variable-role states: `ready->active:dev` succeeds for `active` state
4. Enforcement catches null role: transition to `approved` with no `newRole` and currentRole=null is rejected
5. `any->cancelled:system` sets role=liaison
6. Migration script fixes historical data
7. Migration script is idempotent
8. Error message is actionable (contains expected role, actual role, fix suggestion)
9. WORKFLOW.md v17 exists with changelog
10. Normal workflow path unaffected
