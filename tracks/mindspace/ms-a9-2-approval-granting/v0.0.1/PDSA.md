# PDSA: Approval Granting Endpoint

**Task:** ms-a9-2-approval-granting
**Status:** Design
**Version:** v0.0.1

## Plan

Add PUT endpoints to approve or reject pending approval requests. Approval triggers the pending transition (approval→approved). Rejection returns task to rework.

### Dependencies
- ms-a9-1-approval-requests (approval_requests table + auto-create)
- t1-3-repos-bootstrap

### Investigation

**Current state (`api/routes/approval-requests.ts`):**
- GET `/` lists approval requests with optional `?status=` filter
- GET `/:approvalId` returns single request
- No PUT/approve or PUT/reject endpoints yet

**`task-transitions.ts`:** Auto-creates approval_request with status='pending' on transition to 'approval'.

**Design decisions:**
1. PUT `/:approvalId/approve` (admin only) — sets approval status=approved, transitions task approval→approved
2. PUT `/:approvalId/reject` (admin only) — sets approval status=rejected, transitions task to rework, requires `reason`
3. Rejected approvals record rejection_reason
4. Only pending approvals can be approved/rejected
5. Reuse existing `validateTransition` + `computeRole` from state machine

## Do

### File Changes

#### 1. `api/routes/approval-requests.ts` (UPDATE)

Add two PUT endpoints:

```typescript
// PUT /:approvalId/approve — approve request (admin only)
approvalRequestsRouter.put('/:approvalId/approve', requireProjectAccess('admin'), (req, res) => {
  const { slug, approvalId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ? AND project_slug = ?').get(approvalId, slug) as any;
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be approved' });

  // Update approval request
  db.prepare("UPDATE approval_requests SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .run(user.id, approvalId);

  // Transition task: approval → approved
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id) as any;
  const newRole = computeRole(task.status, 'approved', 'liaison');
  db.prepare("INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, actor_role) VALUES (?, ?, ?, 'approved', ?, ?)")
    .run(randomUUID(), task.id, task.status, user.id, newRole);
  db.prepare("UPDATE tasks SET status = 'approved', current_role = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newRole, task.id);

  const updated = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId);
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.task_id);
  res.status(200).json({ approval: updated, task: updatedTask });
});

// PUT /:approvalId/reject — reject request (admin only)
approvalRequestsRouter.put('/:approvalId/reject', requireProjectAccess('admin'), (req, res) => {
  const { slug, approvalId } = req.params;
  const user = (req as any).user;
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Missing required field: reason' });

  // ... similar pattern, transitions task to 'rework' ...
});
```

## Study

### Test Cases (10)
1. PUT approve on pending request → status becomes 'approved'
2. Task transitions from approval→approved on approve
3. Task role changes to 'qa' after approval (computeRole)
4. PUT reject on pending request → status becomes 'rejected'
5. Task transitions to rework on reject
6. Reject requires reason field
7. Cannot approve non-pending request (400)
8. Cannot reject non-pending request (400)
9. Approval request not found → 404
10. Non-admin cannot approve (403)

## Act

### Deployment
- 1 file update: approval-requests.ts
- May need approved_by, approved_at, rejection_reason columns on approval_requests table (migration update)
