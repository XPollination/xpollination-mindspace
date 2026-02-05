# PDSA: Properly Enforce PDSA Approval Gate

**Date:** 2026-02-05
**Task:** fix-workflow-pdsa-approval-enforcement
**Status:** Design Complete

---

## PLAN

### Context
Previous fix (workflow-pdsa-approval-bypass) was implemented incorrectly. Dev changed tests to match their implementation instead of fixing implementation to match tests.

**Lesson Learned:** DEV MUST NEVER MODIFY TEST FILES
(Reference: /home/developer/.claude/lessons-learned/2026-02-05-dev-cannot-change-tests.md)

### Problem
PDSA tasks can bypass approval gate via `active->review` instead of `active->approval`.

### Current Implementation (workflow-engine.js:127-136)
```javascript
// Check actor permission FIRST
if (actor !== 'system' && !rule.allowedActors.includes(actor)) {
  return `Actor ${actor} not allowed for transition ${transitionKey}. Allowed: ${rule.allowedActors.join(', ')}`;
}

// Check role requirement SECOND
if (rule.requireRole && currentRole !== rule.requireRole) {
  return `Only role=${rule.requireRole} can claim this task. Current role: ${currentRole}`;
}
```

### Current Bug
When PDSA-role task tries `active->review`:
1. Actor 'pdsa' checked against allowedActors ['dev', 'liaison'] → FAIL
2. Error: "Actor pdsa not allowed for transition active->review. Allowed: dev, liaison"
3. The `requireRole: 'dev'` check NEVER RUNS because actor check fails first

### Expected Behavior
When PDSA-role task tries `active->review`:
- Error: "Only role=dev can use this transition"
- Focus is on TASK ROLE, not who triggered it

---

## DO

### Solution: Reorder Validation Checks

The `requireRole` check should happen BEFORE the `allowedActors` check.

**Why:** The requireRole constraint is about WHICH TASKS can use a transition (based on task role). The allowedActors constraint is about WHO can perform the transition. Task role is the primary gate.

### Proposed Code Change (workflow-engine.js)

```javascript
export function validateTransition(nodeType, fromStatus, toStatus, actor, currentRole) {
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType];
  if (!typeTransitions) {
    return `Invalid type: ${nodeType}. Allowed: ${VALID_TYPES.join(', ')}`;
  }

  const transitionKey = `${fromStatus}->${toStatus}`;
  let rule = null;

  // Check for role-specific transition FIRST (e.g., ready->active:dev)
  if (currentRole) {
    rule = typeTransitions[`${transitionKey}:${currentRole}`];
  }

  // Fall back to generic transition if no role-specific rule
  if (!rule) {
    rule = typeTransitions[transitionKey];
  }

  // Check for 'any' transitions (blocked, cancelled)
  if (!rule) {
    rule = typeTransitions[`any->${toStatus}`];
  }

  if (!rule) {
    return `Transition ${transitionKey} not allowed for type=${nodeType}. Undefined transitions are PROHIBITED.`;
  }

  // ============================================================
  // CRITICAL: Check role requirement FIRST (this is the fix!)
  // ============================================================
  // The requireRole check answers: "Can this TASK use this transition?"
  // It should fail BEFORE we check who is performing it.
  if (rule.requireRole && currentRole !== rule.requireRole) {
    return `Only role=${rule.requireRole} can use this transition. Task role: ${currentRole}`;
  }

  // Check actor permission SECOND
  // The allowedActors check answers: "Can this ACTOR perform the transition?"
  if (actor !== 'system' && !rule.allowedActors.includes(actor)) {
    return `Actor ${actor} not allowed for transition ${transitionKey}. Allowed: ${rule.allowedActors.join(', ')}`;
  }

  return null; // Valid
}
```

### Error Message Update
Changed from:
```
"Only role=${rule.requireRole} can claim this task. Current role: ${currentRole}"
```
To:
```
"Only role=${rule.requireRole} can use this transition. Task role: ${currentRole}"
```

This clarifies that:
- "claim" is specific to ready->active
- This error applies to ANY transition with requireRole

---

## STUDY

### Benefits
1. **Correct error message** - Focuses on task role, not actor
2. **Clear semantics** - Task role determines WHICH transitions are valid
3. **Simple fix** - Just reorder two checks
4. **No transition definition changes** - Rules stay the same

### Test Expectations (DO NOT MODIFY THESE)
The existing tests expect:
- PDSA-role task active->review fails with message containing "Only role=dev"
- Dev-role task active->approval fails with message containing "Only role=pdsa"

### Verification
After fix, running the test should pass WITHOUT modification:
```javascript
expect(result).toContain('Only role=dev');
```

---

## ACT

### Acceptance Criteria

- [ ] AC1: PDSA-role tasks CANNOT transition active->review
- [ ] AC2: PDSA-role tasks CAN transition active->approval
- [ ] AC3: Dev-role tasks CANNOT transition active->approval
- [ ] AC4: Dev-role tasks CAN transition active->review
- [ ] AC5: Error message format is "Only role=X can use this transition"
- [ ] AC6: All existing tests pass WITHOUT modification
- [ ] AC7: Dev agent confirms reading lesson learned before implementation

### Files to Modify
- `src/db/workflow-engine.js` - Reorder validation checks in validateTransition()

### Implementation Instructions for Dev

1. **FIRST**: Read the lesson learned file:
   ```bash
   cat /home/developer/.claude/lessons-learned/2026-02-05-dev-cannot-change-tests.md
   ```

2. **THEN**: Modify `validateTransition()` in workflow-engine.js:
   - Move the requireRole check (lines 134-136) BEFORE the allowedActors check (lines 129-131)
   - Update the error message to: `Only role=${rule.requireRole} can use this transition. Task role: ${currentRole}`

3. **DO NOT**: Modify any test files

4. **Run tests**: `npm test -- src/db/__tests__/workflow-engine.test.ts`

5. **If tests fail**: Fix the IMPLEMENTATION, not the tests. If you cannot make tests pass, escalate to PDSA.

### Test Command
```bash
npm test -- src/db/__tests__/workflow-engine.test.ts
```
