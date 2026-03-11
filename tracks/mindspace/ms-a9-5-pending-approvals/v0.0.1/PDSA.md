# PDSA: Pending Approvals Query

**Task:** ms-a9-5-pending-approvals
**Status:** Design
**Version:** v0.0.1

## Plan

Enhance approval requests list endpoint with count for viz badge display. Already partially implemented — GET `/` supports `?status=pending`. Add a dedicated count endpoint for badge use.

### Dependencies
- ms-a9-1-approval-requests

### Investigation

**Current state (`api/routes/approval-requests.ts`):**
- GET `/` already supports `?status=pending` filter
- Missing: count-only endpoint for badge counter

**Design decisions:**
1. Add GET `/count` endpoint returning `{ pending: N, total: N }` — lightweight for badge polling
2. Include project-scoped count in project status response

## Do

### File Changes

#### 1. `api/routes/approval-requests.ts` (UPDATE)
```typescript
// GET /count — approval counts for badge
approvalRequestsRouter.get('/count', requireProjectAccess('viewer'), (req, res) => {
  const { slug } = req.params;
  const db = getDb();
  const pending = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE project_slug = ? AND status = 'pending'").get(slug) as any;
  const total = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE project_slug = ?").get(slug) as any;
  res.status(200).json({ pending: pending.count, total: total.count });
});
```

## Study

### Test Cases (6)
1. GET /count returns `{ pending: N, total: N }`
2. pending=0 when no pending approvals
3. Count reflects only project-scoped approvals
4. GET /?status=pending still works (existing behavior)
5. Count updates after approval/rejection
6. Non-viewer cannot access count (403)

## Act
- 1 file update: approval-requests.ts
- Lightweight addition, no migration
