# PDSA: Flag Toggle Endpoint (Human Gate for ON)

**Task:** ms-a10-3-flag-toggle
**Status:** Design
**Version:** v0.0.1

## Plan

Dedicated toggle endpoint for feature flags with human gate: toggling ON requires admin approval (human gate via approval system), toggling OFF is immediate (emergency rollback).

### Dependencies
- ms-a10-1-feature-flags-table
- ms-a9-1-approval-requests

### Investigation

**Current state (`api/routes/feature-flags.ts`):**
- PUT `/:flagId` already has admin-only gate for toggling ON (line 126)
- But it's a direct toggle, not approval-based

**Design decisions:**
1. New PUT `/:flagId/toggle` endpoint with approval flow
2. Toggle OFF: immediate, any contributor can do it (emergency rollback)
3. Toggle ON: creates approval_request, flag stays OFF until approved
4. On approval: callback sets flag state to 'on'
5. Alternative: keep current direct PUT for admin (existing behavior), add toggle as approval-gated alternative

## Do

### File Changes

#### 1. `api/routes/feature-flags.ts` (UPDATE)
```typescript
// PUT /:flagId/toggle — toggle with human gate for ON
featureFlagsRouter.put('/:flagId/toggle', requireProjectAccess('contributor'), (req, res) => {
  const { slug, flagId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const flag = db.prepare('SELECT * FROM feature_flags WHERE id = ? AND project_slug = ?').get(flagId, slug) as any;
  if (!flag) return res.status(404).json({ error: 'Flag not found' });

  if (flag.state === 'on') {
    // Toggle OFF: immediate (emergency rollback)
    db.prepare("UPDATE feature_flags SET state = 'off', toggled_by = ?, toggled_at = datetime('now') WHERE id = ?")
      .run(user.id, flagId);
    const updated = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(flagId);
    return res.status(200).json({ action: 'toggled_off', flag: updated });
  }

  // Toggle ON: create approval request
  const approvalId = randomUUID();
  db.prepare(
    "INSERT INTO approval_requests (id, task_id, project_slug, requested_by, status, metadata) VALUES (?, ?, ?, ?, 'pending', ?)"
  ).run(approvalId, flag.task_id, slug, user.id, JSON.stringify({ type: 'flag_toggle', flag_id: flagId }));

  return res.status(202).json({ action: 'approval_required', approval_request_id: approvalId, flag });
});
```

## Study

### Test Cases (8)
1. Toggle OFF when ON → immediate state change to 'off'
2. Toggle ON when OFF → returns 202 with approval_request_id
3. Approval request created with type='flag_toggle' metadata
4. Flag stays OFF until approval granted
5. Any contributor can toggle OFF (emergency rollback)
6. Flag not found → 404
7. Toggle OFF records toggled_by user
8. Repeated toggle OFF on already-off flag is idempotent

## Act
- 1 file update: feature-flags.ts
- Depends on approval_requests metadata column (may need migration if not present)
