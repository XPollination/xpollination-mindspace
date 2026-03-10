# PDSA: Workflow hard gate — 100% test pass required for completion

**Task:** wf-test-pass-gate
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Currently, `review->complete` transitions only require `abstract_ref` in DNA. There is no enforcement that all tests pass before a task can be completed. An agent (or liaison) could complete a task with failing tests, allowing broken code into the pipeline.

## Requirements (AC from task DNA)

1. Engine rejects `review->complete` when `test_pass_count < test_total_count`
2. Engine rejects `review->complete` when `test_total_count` is missing or 0
3. Gate applies regardless of liaison approval mode (auto/semi/manual)
4. Gate cannot be bypassed by any actor including liaison or system
5. DNA must contain `test_pass_count` and `test_total_count` fields (set by QA)
6. Clear error message returned when gate blocks: which tests failed, count mismatch
7. Rework transition is the only path forward when gate blocks

## Investigation

### Current enforcement mechanism

The workflow engine (`src/db/workflow-engine.js`) uses two layers of validation:

1. **`validateTransition()`** (line 138) — Checks actor permissions, role requirements, and status transitions. The `system` actor bypasses actor checks (`actor !== 'system'` at line 180), but DNA requirements are enforced separately.

2. **`validateDnaRequirements()`** (line 271) — Checks that required DNA fields exist (truthy check: `!dna[field]`). Called from `interface-cli.js` line 528. The `system` actor does NOT bypass this — DNA requirements apply to all actors.

### Current `review->complete` rules

- **Task type** (line 83): `{ allowedActors: ['liaison'], newRole: 'liaison', requiresHumanConfirm: true, requiresDna: ['abstract_ref'] }`
- **Bug type** (line 111): `{ allowedActors: ['liaison'], newRole: 'liaison', requiresDna: ['abstract_ref'] }`

### Field existence vs value validation

`requiresDna` only checks field existence (`!dna[field]`). For the test pass gate, we need **value validation**: `test_pass_count === test_total_count` AND `test_total_count > 0`. This requires custom logic in `validateDnaRequirements()`, following the pattern used for `pdsa_ref` and `abstract_ref` GitHub link validation (lines 301-308).

### FIELD_VALIDATORS in interface-cli.js

`FIELD_VALIDATORS` (line 131) validates DNA field values at **write time** (`update-dna`). Currently validates: `status`, `role`, `pdsa_file`, `pdsa_ref`. Adding validators for `test_pass_count` and `test_total_count` ensures values are integers at write time.

### Actor bypass analysis

- `validateTransition()`: `system` bypasses actor check but not DNA requirements
- `validateDnaRequirements()`: No actor bypass — applies to everyone
- Placing the test pass gate inside `validateDnaRequirements()` ensures it cannot be bypassed by any actor

## Design

### File 1: `src/db/workflow-engine.js` (UPDATE)

**Change 1: Add `test_pass_count` and `test_total_count` to `requiresDna` for `review->complete`**

Both task and bug types:

```javascript
// Task type (line 83):
'review->complete': { allowedActors: ['liaison'], newRole: 'liaison', requiresHumanConfirm: true, requiresDna: ['abstract_ref', 'test_pass_count', 'test_total_count'] },

// Bug type (line 111):
'review->complete': { allowedActors: ['liaison'], newRole: 'liaison', requiresDna: ['abstract_ref', 'test_pass_count', 'test_total_count'] },
```

This ensures both fields must exist (non-falsy) before completion.

**Change 2: Add test pass gate validation in `validateDnaRequirements()`**

After the existing field-specific checks (pdsa_ref, abstract_ref GitHub link validation), add:

```javascript
// Test pass gate: 100% test pass required for completion
// This is a hard gate — no actor, no mode, no override can bypass it
if (field === 'test_total_count' && typeof dna[field] === 'number') {
  if (dna[field] <= 0) {
    return `Test pass gate: test_total_count must be > 0 (got ${dna[field]}). QA must run tests before completion.`;
  }
}
if (field === 'test_pass_count' && typeof dna.test_total_count === 'number' && typeof dna[field] === 'number') {
  if (dna[field] !== dna.test_total_count) {
    const failed = dna.test_total_count - dna[field];
    return `Test pass gate: ${dna[field]}/${dna.test_total_count} tests pass (${failed} failing). All tests must pass for completion. Rework is the only path forward.`;
  }
}
```

This is placed inside the `for (const field of rule.requiresDna)` loop, after the GitHub link checks. It runs on every transition that lists these fields in `requiresDna`, but only `review->complete` does.

### File 2: `src/db/interface-cli.js` (UPDATE)

**Change: Add FIELD_VALIDATORS for test_pass_count and test_total_count**

```javascript
// Validate test_pass_count (must be non-negative integer)
test_pass_count: (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return `test_pass_count must be a non-negative integer, got: ${JSON.stringify(value)}`;
  }
  return null;
},

// Validate test_total_count (must be positive integer)
test_total_count: (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return `test_total_count must be a non-negative integer, got: ${JSON.stringify(value)}`;
  }
  return null;
},
```

These ensure that when QA sets these fields via `update-dna`, they must be valid integers.

## Files Changed

1. `src/db/workflow-engine.js` — Add test fields to `requiresDna` on `review->complete` (both task and bug), add value validation in `validateDnaRequirements()` (UPDATE)
2. `src/db/interface-cli.js` — Add `FIELD_VALIDATORS` entries for `test_pass_count` and `test_total_count` (UPDATE)

## Testing

1. `review->complete` blocked when `test_pass_count` missing from DNA
2. `review->complete` blocked when `test_total_count` missing from DNA
3. `review->complete` blocked when `test_total_count` is 0
4. `review->complete` blocked when `test_pass_count < test_total_count` (e.g., 18/20)
5. `review->complete` allowed when `test_pass_count === test_total_count` (e.g., 20/20)
6. Gate applies to task type `review->complete`
7. Gate applies to bug type `review->complete`
8. Gate cannot be bypassed by `system` actor
9. Gate cannot be bypassed by `liaison` actor
10. Error message includes pass count, total count, and failing count
11. Error message mentions rework as the only path forward
12. `test_pass_count` field validator rejects non-integer values
13. `test_total_count` field validator rejects non-integer values
14. `test_pass_count` field validator rejects negative values
15. `test_total_count` field validator rejects negative values
16. `test_pass_count` field validator accepts valid non-negative integer
17. `test_total_count` field validator accepts valid non-negative integer
18. Gate works regardless of liaison approval mode (auto/semi/manual) — tested by confirming no mode-specific bypass in the code path
19. Existing `abstract_ref` requirement still enforced on `review->complete`
