# PDSA: Branch Name Validation on Task Claim

**Task:** ms-a10-5-branch-validation
**Status:** Design
**Version:** v0.0.1

## Plan

Advisory branch name validation on task claim. Logs a warning if agent is not on the expected `feature/<task-id>` branch. Does not block the claim.

### Dependencies
- ms-a3-3-task-claiming

### Investigation

**Current claiming (`api/routes/task-claiming.ts`):**
- No branch validation
- Claim body has no branch field

**Design decisions:**
1. Add optional `branch` field to claim request body
2. If provided, validate against expected pattern: `feature/<task-slug>` or `develop`
3. Non-conforming branch → include `branch_warning` in response
4. Never blocks the claim (advisory only)
5. Log warning to console for monitoring

## Do

### File Changes

#### 1. `api/routes/task-claiming.ts` (UPDATE)
```typescript
taskClaimingRouter.post('/:taskId/claim', requireProjectAccess('contributor'), (req, res) => {
  // ... existing claim logic ...
  const { branch } = req.body;

  let branch_warning: string | null = null;
  if (branch) {
    const expectedPatterns = [`feature/${task.id}`, `feature/${task.title?.toLowerCase().replace(/\s+/g,'-')}`, 'develop'];
    if (!expectedPatterns.some(p => branch.includes(p))) {
      branch_warning = `Advisory: expected branch pattern feature/<task-id> or develop, got '${branch}'`;
      console.warn(`[branch-validation] Task ${taskId}: ${branch_warning}`);
    }
  }

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json({ ...updated, branch_warning });
});
```

## Study

### Test Cases (6)
1. Claim with matching branch → no warning
2. Claim with non-matching branch → warning in response
3. Claim without branch field → no warning (backward compatible)
4. Warning does not block claim (task still claimed)
5. `develop` branch is acceptable
6. Warning logged to console

## Act
- 1 file update: task-claiming.ts
- No migration, no breaking changes
