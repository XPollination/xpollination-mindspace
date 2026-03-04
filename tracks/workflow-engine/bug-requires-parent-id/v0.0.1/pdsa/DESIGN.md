# PDSA: Bug Requires Parent ID — v0.0.1

## PLAN

### Problem
Bug-type tasks can be created without `parent_ids`, breaking traceability. Every bug is a follow-up or regression from an existing task. Without the parent link, we lose the chain of causation.

Examples from 2026-03-04:
- `viz-rework-button-broken` correctly linked to parent `viz-missing-confirm-button`
- `approval-mode-reverts-to-manual-again` correctly linked to parent `viz-approval-mode-resets`
- `rework-transition-wrong-role` was created WITHOUT a parent (should have linked to the originating task)

### Design

Add a type-specific validation in `cmdCreate()` in `interface-cli.js`.

#### Gate Location
In `cmdCreate()`, after DNA field validation (line ~711) and before database operations (line ~713). This is the natural location for type-specific DNA requirements.

#### Gate Logic

```javascript
// Bug type requires parent_ids for traceability
if (type === 'bug') {
  if (!dna.parent_ids || !Array.isArray(dna.parent_ids) || dna.parent_ids.length === 0) {
    error('Bug type requires parent_ids — every bug must link to the task it originated from. Use parent_ids: ["parent-slug"] in DNA.');
  }
}
```

#### Changes Required

1. **`src/db/interface-cli.js`** (~5 lines):
   - Add bug parent_ids validation after `validateDnaFields()` check (line ~711), before `getDb()` (line ~713)
   - Simple: if type is `bug` and parent_ids is empty/missing/not-array, reject with clear error

#### What This Does NOT Do

- Does NOT validate that parent slugs actually exist in the database (that's a separate concern — parents may be in a different project DB)
- Does NOT enforce parent_ids for `task` type (tasks can be top-level)
- Does NOT change the schema or add new columns
- Does NOT affect transitions, only creation

#### Risks

- **Low risk**: Only adds validation on create, doesn't change existing data
- **Edge case**: If a bug truly has no parent (e.g., discovered independently), the creator must still provide a related task slug. This is intentional — orphan bugs reduce traceability

## DO

Implementation by DEV agent. Add ~5 lines to `cmdCreate()` in `interface-cli.js`.

## STUDY

After implementation:
- Verify `create bug slug '{"title":"...","role":"dev"}'` fails with clear error
- Verify `create bug slug '{"title":"...","role":"dev","parent_ids":["parent-slug"]}'` succeeds
- Verify `create task slug '{"title":"...","role":"dev"}'` still works (no parent required)

## ACT

If gate works: standardize. Consider adding parent existence validation in a future version.
