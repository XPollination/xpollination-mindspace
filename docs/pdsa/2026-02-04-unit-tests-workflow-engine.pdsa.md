# PDSA: Unit Tests for Workflow Engine

**Date:** 2026-02-04
**Node:** unit-tests-workflow-engine (35128301-cfcd-4a53-b168-04eea8df74bc)
**Type:** Task
**Status:** ACTIVE
**Iteration:** 1

## PLAN

### Problem Statement

The workflow engine in interface-cli.js has no unit tests. This is a risk because:
1. Behavior is undocumented
2. Regressions can occur silently
3. The CRITICAL PRINCIPLE ("if system doesn't PREVENT, it WILL happen") depends on tests to verify prevention

### Scope

Test the following functions/constants:
- `ALLOWED_TRANSITIONS` constant - transition whitelist
- `validateTransition()` - validates transitions against whitelist
- `validateCreate()` (implicit in cmdCreate) - validates types
- Immutability check in `cmdUpdateDna()`
- Role auto-update via `getNewRoleForTransition()`

### Test Framework

Project uses **vitest** (confirmed in package.json).

---

## DO (Test Plan)

### AC1: Test ALLOWED_TRANSITIONS

**Test file:** `src/db/__tests__/workflow-engine.test.js`

| Test Case | Input | Expected |
|-----------|-------|----------|
| Task pending→ready allowed | type=task, pending→ready, actor=liaison | Pass (no error) |
| Task ready→active allowed for pdsa | type=task, ready→active, actor=pdsa, role=pdsa | Pass |
| Task undefined transition rejected | type=task, pending→complete | Error: "not allowed...PROHIBITED" |
| Bug pending→ready allowed | type=bug, pending→ready, actor=dev | Error (dev not in allowedActors) |
| Bug pending→ready allowed by pdsa | type=bug, pending→ready, actor=pdsa | Pass |

### AC2: Test validateTransition()

**Function signature:** `validateTransition(nodeType, fromStatus, toStatus, actor, currentRole)`

| Test Case | Inputs | Expected Return |
|-----------|--------|-----------------|
| Valid transition returns null | task, pending, ready, liaison, null | null |
| Invalid type returns error | 'design', pending, ready, liaison, null | "Invalid type: design..." |
| Undefined transition returns error | task, pending, complete, liaison, null | "Transition pending->complete not allowed..." |
| Wrong actor returns error | task, pending, ready, dev, null | "Actor dev not allowed for transition..." |
| Role mismatch returns error | task, ready, active, pdsa, 'dev' | "Only role=pdsa can claim this task..." |
| Any→blocked allowed | task, active, blocked, liaison, pdsa | null |

### AC3: Test validateCreate() (Type Validation)

**Via cmdCreate()** - type validation at line 455-458

| Test Case | Type Input | Expected |
|-----------|------------|----------|
| task allowed | 'task' | Created successfully |
| bug allowed | 'bug' | Created successfully |
| design rejected | 'design' | Error: "Invalid type: design. Only allowed: task, bug" |
| requirement rejected | 'requirement' | Error: "Invalid type..." |
| empty string rejected | '' | Error: "Invalid type..." |

### AC4: Test Immutability (Complete Tasks)

**In cmdUpdateDna()** - immutability check at lines 425-429

| Test Case | Status | DNA Update | Expected |
|-----------|--------|------------|----------|
| active task can update | active | {role: 'dev'} | Success |
| complete task CANNOT update | complete | {note: 'test'} | Error: "Cannot modify complete task..." |
| rework task can update | rework | {findings: '...'} | Success |

### AC5: Test Role Auto-Update

**Via getNewRoleForTransition()** and transition logic

| Test Case | Transition | Expected Role Change |
|-----------|------------|---------------------|
| task pending→ready | task, pending→ready | role = pdsa |
| task approved→ready | task, approved→ready | role = dev |
| task active→review | task, active→review | role = qa |
| task review→rework | task, review→rework | role = dev |
| bug pending→ready | bug, pending→ready | role = dev |
| bug active→review | bug, active→review | role = qa |

### AC6: Test review→rework Sets Role to Dev

**Specific test for bug fix item 12**

| Test Case | Type | Transition | Actor | Expected |
|-----------|------|------------|-------|----------|
| task review→rework sets dev | task | review→rework | qa | role = dev |
| bug review→rework sets dev | bug | review→rework | qa | role = dev |

---

## STUDY

### Test Structure

```
src/db/__tests__/
└── workflow-engine.test.js
    ├── describe('ALLOWED_TRANSITIONS')
    │   ├── test('task transitions')
    │   └── test('bug transitions')
    ├── describe('validateTransition')
    │   ├── test('valid transitions return null')
    │   ├── test('invalid type returns error')
    │   ├── test('undefined transition returns error')
    │   ├── test('wrong actor returns error')
    │   ├── test('role mismatch returns error')
    │   └── test('any->blocked/cancelled allowed')
    ├── describe('Type Validation (cmdCreate)')
    │   ├── test('task allowed')
    │   ├── test('bug allowed')
    │   └── test('invalid types rejected')
    ├── describe('Immutability')
    │   ├── test('active task can update')
    │   └── test('complete task cannot update')
    └── describe('Role Auto-Update')
        ├── test('pending->ready sets correct role')
        ├── test('active->review sets qa')
        └── test('review->rework sets dev')
```

### Implementation Notes

1. **Unit tests should not touch database** - Extract functions for pure testing
2. **interface-cli.js is ES module** - Tests must use ES module syntax
3. **Functions are not exported** - May need to refactor for testability:
   - Option A: Export functions
   - Option B: Test via CLI subprocess (slower)
   - Option C: Create separate workflow-engine.js module

### Recommended Approach

**Option C: Create separate module**

Refactor workflow engine logic into `src/db/workflow-engine.js`:
- Export: `ALLOWED_TRANSITIONS`, `validateTransition()`, `getNewRoleForTransition()`, `VALID_TYPES`
- Import in `interface-cli.js`
- Test the module directly

This provides:
- Pure unit tests (no subprocess, no database)
- Clean separation of concerns
- Documented API via exports

---

## ACT

### Implementation Tasks for Dev

1. **Create workflow-engine.js module**
   - Location: `src/db/workflow-engine.js`
   - Export: ALLOWED_TRANSITIONS, VALID_TYPES, VALID_STATUSES, validateTransition, getNewRoleForTransition

2. **Refactor interface-cli.js**
   - Import from workflow-engine.js
   - Keep cmdXxx functions in interface-cli.js

3. **Create test file**
   - Location: `src/db/__tests__/workflow-engine.test.js`
   - Use vitest: `import { describe, test, expect } from 'vitest'`
   - Implement all test cases from DO section

4. **Run tests**
   - Command: `npm test`
   - Verify all 6 ACs pass

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-unit-tests-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-unit-tests-workflow-engine.pdsa.md
