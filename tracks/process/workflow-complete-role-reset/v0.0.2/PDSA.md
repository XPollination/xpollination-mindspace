# PDSA: Workflow engine — role consistency enforcement on transitions

**Task:** workflow-complete-role-reset
**Version:** v0.0.2 (rework of v0.0.1)
**Author:** PDSA agent
**Date:** 2026-03-10

## Rework Context

v0.0.1 was rejected. Thomas's feedback (verbatim):

> "FULL REWORK. Wrong approach: the safety net silently corrects role on complete transition, which MASKS workflow violations. If QA or any agent bypasses the workflow and triggers an invalid complete transition, the engine would silently fix it — hiding the root cause. We need ENFORCEMENT, not correction. The engine must REJECT invalid transitions with a clear error so the violating agent is forced to correct its behavior. Design principle: the workflow engine is a gate that prevents invalid states, not a janitor that cleans up after them."

## Problem

69 of 145 complete tasks have wrong roles (10 qa, 6 dev, 12 pdsa, 41 null). The v0.0.1 design proposed silently overwriting the role to `liaison` on complete transitions. This masks workflow violations — if an agent misconfigures a transition rule (missing `newRole`) or bypasses the normal path, the engine would hide the problem.

## Analysis

### What WORKFLOW.md v16 defines as fixed-role states

Some states always have a specific monitor role, regardless of context:

| State | Expected Role | Source |
|-------|--------------|--------|
| `complete` | `liaison` | WORKFLOW.md line 24 |
| `approval` | `liaison` | WORKFLOW.md line 15 |
| `approved` | `qa` | WORKFLOW.md line 16 |
| `testing` | `qa` | WORKFLOW.md lines 17-18 |
| `cancelled` | `liaison` | (terminal state, liaison owns) |

Other states (`active`, `review`, `ready`, `rework`, `pending`, `blocked`) have variable roles depending on context — these are NOT validated.

### Current engine behavior

The existing transitions already define correct `newRole` values:
- `review->complete` has `newRole: 'liaison'`
- `approval->complete` has `newRole: 'liaison'`
- `approval->approved` has `newRole: 'qa'`
- `active->approval` has `newRole: 'liaison'`
- etc.

The 69 broken tasks are historical (pre-engine or direct DB writes). The engine rules are correct today. But if a new transition rule is added in the future without `newRole`, or if a code path skips the role assignment, there's no guard. The safety net approach would hide such a bug. Enforcement catches it.

### Design: Post-transition role consistency validation

Add a **role consistency check** in `cmdTransition` that runs AFTER the `newRole` is computed (from rules + rework overrides) but BEFORE the DB write. For fixed-role states, the check validates that the effective role matches the expected role. If it doesn't, the transition is **REJECTED** with a clear error message.

This catches:
1. Future transition rules with missing/wrong `newRole` — build-time protection
2. Code paths that skip role assignment — runtime protection
3. Misconfigured rework overrides — configuration protection

## Design

### Change A: Role consistency map in workflow-engine.js

Add a new exported constant `EXPECTED_ROLES_BY_STATE` and a validation function:

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

**Location:** After `getHumanConfirmTransitions()` in workflow-engine.js (end of file).

### Change B: Enforcement gate in interface-cli.js cmdTransition

In `cmdTransition`, after all `newRole` computations (line ~667, after rework_target_role handling) and before the DNA write (line ~668), add:

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

### Change C: Cleanup migration script (unchanged from v0.0.1)

Create `src/db/migrations/v17-complete-role-reset.js` — one-time fix for 69 historical tasks. Same script as v0.0.1 since historical data still needs fixing. The migration is a one-time data repair, not ongoing correction.

```javascript
// One-time migration: fix role on all complete tasks
// Run via: DATABASE_PATH=... node src/db/migrations/v17-complete-role-reset.js

import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH;
if (!dbPath) { console.error('DATABASE_PATH required'); process.exit(1); }

const db = new Database(dbPath);
const rows = db.prepare(`
  SELECT id, slug, dna_json FROM mindspace_nodes
  WHERE status = 'complete'
`).all();

let fixed = 0;
for (const row of rows) {
  const dna = JSON.parse(row.dna_json);
  if (dna.role !== 'liaison') {
    dna.role = 'liaison';
    db.prepare(`
      UPDATE mindspace_nodes SET dna_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(dna), row.id);
    fixed++;
  }
}

console.log(`Fixed ${fixed} of ${rows.length} complete tasks (set role=liaison)`);
db.close();
```

Run against ALL project databases:
- `xpollination-mcp-server/data/xpollination.db`
- `HomePage/data/xpollination.db`
- `xpollination-best-practices/data/xpollination.db`

### Change D: Workflow version bump v16 → v17

In `tracks/process/context/WORKFLOW.md`, update header to v17 and add changelog entry:

```
| 2026-03-10 | v17 Role consistency enforcement: engine REJECTS transitions that produce wrong role for fixed-role states (complete, approval, approved, testing, cancelled). One-time migration fixes 69 historical complete tasks. Enforcement principle: prevent invalid states, don't silently correct them | PDSA |
```

### Change E: `any->cancelled:system` exemption

The `any->cancelled:system` transition has no `newRole` defined, which means `effectiveRole` could be anything. Since system cancellations are automated and cancelled is a terminal state, add `newRole: 'liaison'` to the `any->cancelled:system` rule in ALLOWED_TRANSITIONS (both task and bug types). This makes it consistent with the enforcement check.

Alternatively, the system actor could be exempted from role consistency checks. But adding `newRole: 'liaison'` is cleaner — it makes the rule explicit rather than creating an exception.

### Files Changed

1. `xpollination-mcp-server/src/db/workflow-engine.js` — `EXPECTED_ROLES_BY_STATE` constant + `validateRoleConsistency()` function + `newRole: 'liaison'` on `any->cancelled:system`
2. `xpollination-mcp-server/src/db/interface-cli.js` — 4-line enforcement gate after role computations + import update
3. `xpollination-mcp-server/src/db/migrations/v17-complete-role-reset.js` — new cleanup script
4. `xpollination-mcp-server/tracks/process/context/WORKFLOW.md` — version bump + changelog

### Testing

1. **Enforcement rejects wrong role:** A transition rule with `newRole: 'dev'` targeting `complete` status is rejected with "Role consistency violation" error
2. **Enforcement allows correct role:** `review->complete` (newRole=liaison) succeeds
3. **Enforcement allows variable-role states:** `ready->active:dev` (newRole not defined, currentRole=dev) succeeds for `active` state
4. **Enforcement catches null role:** A transition to `approved` with no `newRole` and currentRole=null is rejected
5. **approval->complete works:** Liaison completes from approval, role=liaison ✓
6. **approval->approved works:** Liaison approves, role=qa ✓
7. **active->approval works:** PDSA submits, role=liaison ✓
8. **any->cancelled:system sets role=liaison:** System cancellation sets correct role
9. **Migration script fixes historical data:** All complete tasks get role=liaison
10. **Migration script is idempotent:** Running twice produces same result
11. **Normal workflow is unaffected:** Standard transitions through full PDSA path work
12. **Error message is actionable:** Contains expected role, actual role, and fix suggestion
13. **WORKFLOW.md v17 exists:** Header and changelog updated
