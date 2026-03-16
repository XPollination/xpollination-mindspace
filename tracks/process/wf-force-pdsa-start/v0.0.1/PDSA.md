# PDSA: Workflow Engine — Force PDSA Start for All Tasks

**Task:** `ms-wf-force-pdsa-start`
**Priority:** High
**Status:** Design

## Problem

Tasks created with `role=dev` can bypass PDSA planning via a transition matching loophole:

1. CLI builds transition key: `pending->ready`
2. Tries role-specific variant `pending->ready:dev` — requires `pdsa_ref` in DNA
3. If `pdsa_ref` is missing, role-specific variant **fails silently** and falls back to generic `pending->ready`
4. Generic `pending->ready` has **no `pdsa_ref` requirement** — transition succeeds
5. Task is now `ready+dev` with no PDSA design

**Evidence:** All `ms-auth-*` sub-tasks were created with `role=dev` and went straight to implementation without per-task PDSA documents. Caught in review but process should prevent it upfront.

**Root cause location:** `src/db/interface-cli.js` line 637-638 (fallback logic) and `src/db/workflow-engine.js` line 35 (generic `pending->ready` missing role enforcement).

## Design Decisions

### D1: Generic `pending->ready` forces role to PDSA

Change line 35 in `workflow-engine.js`:
```js
// Before:
'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'] },

// After:
'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'], newRole: 'pdsa' },
```

**Effect:** Any task transitioning `pending->ready` without a role-specific variant match gets `role=pdsa`. This ensures PDSA must claim it, design it, and submit to approval before it can reach dev.

**Rationale:** The DNA states "all tasks must go through PDSA first." Setting `newRole: 'pdsa'` is the simplest enforcement — the workflow engine already handles role-matched claiming at `ready->active`.

### D2: Remove `pending->ready:dev` shortcut

Remove line 37 from `workflow-engine.js`:
```js
// Remove:
'pending->ready:dev': { allowedActors: ['liaison', 'system', 'pdsa'], requireRole: 'dev', requiresDna: ['pdsa_ref'] },
```

**Rationale:** This transition was the "design gate" — requiring `pdsa_ref` before dev tasks become ready. But with D1 forcing all tasks through PDSA, this variant is redundant. Dev tasks can no longer reach `ready` with `role=dev` — they must go through `pending->ready` (which sets `role=pdsa`). PDSA then designs, submits to approval, and the workflow routes to dev via `approved->ready` or `testing->ready` (both set `newRole: 'dev'`).

### D3: Bug type keeps its `pending->ready` with `newRole: 'dev'`

Line 109 in `workflow-engine.js` stays unchanged:
```js
'pending->ready': { allowedActors: ['liaison', 'pdsa', 'system'], newRole: 'dev' },
```

**Rationale:** Bug fixes bypass PDSA by design — they are reactive fixes, not planned features. The bug flow `pending->ready->active->review->complete` is intentionally simpler.

### D4: Fix CLI fallback to reject (not bypass) on role-specific failure

Change the transition matching logic in `interface-cli.js` line 637-638. Currently:
```js
let transitionRule = currentRole ? typeTransitions[`${transitionKey}:${currentRole}`] : null;
if (!transitionRule) transitionRule = typeTransitions[transitionKey];
```

This silently falls back to the generic variant when the role-specific one doesn't match. With D1/D2, this fallback is now safe (generic always sets `newRole: 'pdsa'`). However, we should add a log warning when fallback occurs so liaison/system is aware:

```js
let transitionRule = currentRole ? typeTransitions[`${transitionKey}:${currentRole}`] : null;
if (!transitionRule) {
  transitionRule = typeTransitions[transitionKey];
  if (transitionRule && currentRole) {
    console.error(`[workflow] No role-specific transition ${transitionKey}:${currentRole}, using generic ${transitionKey}`);
  }
}
```

This is a diagnostic change, not a blocking change. The enforcement is in D1.

### D5: Tasks created with `role=dev` still valid

No change to task creation. A task can be created with `role=dev` in DNA (describing the intended implementer). But at `pending->ready`, D1 overrides to `role=pdsa`. After PDSA designs and approval passes, the workflow routes to dev via existing transitions (`approved->ready`, `testing->ready`).

The original `role=dev` in DNA is preserved as metadata but the active workflow role is managed by the engine.

## Flow After Fix

```
pending (any role in DNA)
  → ready (pdsa — forced by D1)
  → active (pdsa claims)
  → approval (pdsa submits design)
  → approved (human approves → role=qa)
  → testing (QA writes tests → role=dev)
  → ready (dev)
  → active (dev implements)
  → review chain → complete
```

## Acceptance Criteria

1. `pending->ready` for task type always sets `role=pdsa` (generic variant)
2. `pending->ready:dev` variant removed from task type
3. Bug type `pending->ready` unchanged (`newRole: 'dev'`)
4. CLI logs warning when role-specific fallback occurs
5. Existing tests updated to reflect new transition rules
6. No regression on bug type flow

## Test Plan

1. Create task with `role=dev`, transition `pending->ready` → verify role becomes `pdsa`
2. Create task with `role=pdsa`, transition `pending->ready` → verify role stays `pdsa`
3. Create bug with `role=dev`, transition `pending->ready` → verify role becomes `dev` (unchanged)
4. Attempt `pending->ready:dev` on task → verify rejection (transition removed)
5. Full task lifecycle: pending→ready(pdsa)→active(pdsa)→approval→approved→testing→ready(dev)→active(dev)→review→complete

## Risk Assessment

- **Medium risk:** Changes core workflow rules. But the change is restrictive (adds enforcement, removes bypass). Existing tasks in non-pending states are unaffected.
- **Migration:** No data migration needed. In-flight `pending` tasks will get `role=pdsa` on next transition.
- **Rollback:** Revert the two lines in workflow-engine.js to restore old behavior.
