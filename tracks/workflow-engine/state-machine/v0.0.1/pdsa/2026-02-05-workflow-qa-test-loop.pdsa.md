# PDSA: Workflow - QA Test Creation Loop

**Date:** 2026-02-05
**Task:** workflow-qa-test-loop
**Status:** Design Complete

---

## PLAN

### Problem
Current workflow is missing QA at the proper place:
- QA only appears at review stage to verify
- By then it's too late for proper TDD
- No unit tests exist when dev starts implementing

### Current (Broken) Flow
```
PDSA designs → approval → dev implements → review → complete
```

### Required Flow (TDD-Aligned)
```
PDSA designs
    ↓
LIAISON reviews (quality gate)
    ↓
Thomas approval
    ↓
QA CREATES tests (from ACs)
    ↓
Dev implements (tests exist)
    ↓
QA RUNS tests
    ↓
[fail] → rework to dev
    ↓
[pass] → PDSA final review
    ↓
complete
```

---

## DO

### Solution: New Status "testing" + Phased Roles

#### New Status: `testing`
Add `testing` status for QA test creation phase.

#### Updated Flow with Statuses

| Phase | Status | Role | Action |
|-------|--------|------|--------|
| 1 | pending | - | Task created |
| 2 | ready | pdsa | PDSA designs |
| 3 | active | pdsa | PDSA working |
| 4 | approval | liaison | LIAISON reviews |
| 5 | approval | - | Thomas approves |
| 6 | **testing** | **qa** | QA creates tests |
| 7 | ready | dev | Dev implements |
| 8 | active | dev | Dev working |
| 9 | review | qa | QA runs tests |
| 10 | review | pdsa | PDSA final review (optional) |
| 11 | complete | - | Done |

#### New Transitions

```typescript
// After approval, go to testing for QA
'approved->testing': {
  allowedActors: ['liaison', 'system'],
  newRole: 'qa'
},

// QA completes tests, task ready for dev
'testing->ready': {
  allowedActors: ['qa'],
  newRole: 'dev',
  validate: (task) => {
    // Could require tests exist in DNA
    if (!task.dna?.tests_created) {
      return { valid: false, error: 'QA must create tests before moving to ready' };
    }
    return { valid: true };
  }
},

// Dev completes, goes to review
'active->review': {
  allowedActors: ['dev'],
  newRole: 'qa'  // QA runs tests first
},

// QA test results
'review->rework': {
  allowedActors: ['qa'],
  newRole: 'dev'  // Back to dev if tests fail
},

'review->complete': {
  allowedActors: ['qa', 'pdsa'],  // QA approves or PDSA final review
}
```

### Simplified Alternative: Role Transitions Only

Instead of new status, use role to track phase:

1. `approval` → `ready` (role: qa) - QA creates tests
2. `ready` → `ready` (role: dev) - QA done, dev can start
3. `active` → `review` (role: qa) - Dev done, QA tests
4. `review` → `complete` or `rework`

**Problem:** `ready` → `ready` is weird. Better to have distinct status.

### Recommended: Add "testing" Status

Cleanest solution. Clear distinction between:
- **testing**: QA creating tests (before dev)
- **review**: QA running tests (after dev)

### QA Responsibilities

**Testing Phase (pre-dev):**
1. Read PDSA acceptance criteria
2. Create test cases (in DNA: `tests_planned`)
3. Create unit test files if applicable
4. Transition to ready when tests are defined

**Review Phase (post-dev):**
1. Run tests
2. Verify implementation matches tests
3. If fail: rework with specific failures
4. If pass: complete or PDSA final review

### PDSA Final Review (Optional)

After QA tests pass, PDSA can do a final review:
- Verify design intent was followed
- Check architectural decisions
- Ensure no over-engineering
- Can be skipped for simple tasks

---

## STUDY

### Benefits
1. **TDD-aligned** - Tests exist before dev starts
2. **Clear phases** - Each role knows their phase
3. **Quality gates** - LIAISON, QA, PDSA all review
4. **Traceable** - Tests in DNA track what was tested

### Trade-offs
- Adds workflow complexity
- More status transitions
- May slow down simple tasks

### When to Skip Testing Phase
For trivial tasks (typo fixes, one-line changes), the full loop may be overkill. Consider:
- `dna.skip_testing: true` for trivial tasks
- PDSA marks during design if tests needed

---

## ACT

### Acceptance Criteria

**Workflow Changes:**
- [ ] AC1: Add `testing` status to valid statuses list
- [ ] AC2: Add `approved->testing` transition
- [ ] AC3: Add `testing->ready` transition with validation
- [ ] AC4: Update agent monitor to detect `testing` status for QA

**QA Process:**
- [ ] AC5: QA creates `tests_planned` in DNA during testing phase
- [ ] AC6: QA can only transition `testing->ready` if tests defined
- [ ] AC7: QA runs tests during review phase
- [ ] AC8: Document QA responsibilities at each phase

**Testing:**
- [ ] AC9: Test full loop: PDSA → testing → dev → review → complete
- [ ] AC10: Test rework loop: review → rework → dev → review

### Files to Modify
- `src/workflow/transitions.ts` - Add new transitions
- `src/workflow/states.ts` - Add testing status
- `viz/agent-monitor.cjs` - Add testing status detection for QA

### Implementation Summary

```typescript
// states.ts
export const WORKFLOW_STATES = [
  'pending', 'ready', 'active', 'testing',
  'approval', 'review', 'rework', 'complete',
  'blocked', 'cancelled'
];

// transitions.ts
'approved->testing': { allowedActors: ['liaison', 'system'], newRole: 'qa' },
'testing->ready': { allowedActors: ['qa'], newRole: 'dev' },
```

### Next Steps
1. Thomas approves workflow design
2. Dev implements status and transitions
3. QA validates the full loop works
4. Update agent protocols with new phase
