# PDSA: Approval Expiry Checker

**Task:** ms-a9-3-approval-expiry
**Status:** Design
**Version:** v0.0.1

## Plan

Interval job that checks for expired pending approval requests and returns tasks to their previous state, preventing tasks from being stuck in approval limbo.

### Dependencies
- ms-a9-1-approval-requests (approval_requests table)

### Investigation

**Current approval_requests table (023-approval-requests.sql):**
- Has `created_at` but no `expires_at` column
- Status: pending, approved, rejected — needs 'expired'

**Design decisions:**
1. Add `expires_at` column to approval_requests (default: 24h from creation)
2. New service: `checkExpiredApprovals(db)` — queries pending where `expires_at < now`
3. For each expired: set status='expired', transition task approval→rework with reason
4. Contribute brain thought on expiry (best-effort)
5. Exposed as `POST /api/projects/:slug/approvals/check-expiry` (admin) for manual trigger + interval

## Do

### File Changes

#### 1. `api/db/migrations/025-approval-expiry.sql` (CREATE)
```sql
ALTER TABLE approval_requests ADD COLUMN expires_at TEXT DEFAULT (datetime('now', '+24 hours'));
```

#### 2. `api/services/approval-expiry.ts` (CREATE)
```typescript
export function checkExpiredApprovals(db: any): string[] {
  const expired = db.prepare(
    "SELECT ar.*, t.status as task_status FROM approval_requests ar JOIN tasks t ON t.id = ar.task_id WHERE ar.status = 'pending' AND ar.expires_at < datetime('now')"
  ).all();

  const expiredIds: string[] = [];
  for (const ar of expired) {
    db.prepare("UPDATE approval_requests SET status = 'expired' WHERE id = ?").run(ar.id);
    // Transition task back to rework
    db.prepare("UPDATE tasks SET status = 'rework', current_role = 'dev', updated_at = datetime('now') WHERE id = ?").run(ar.task_id);
    db.prepare("INSERT INTO task_transitions (id, task_id, from_status, to_status, actor, reason) VALUES (?, ?, 'approval', 'rework', 'system', 'Approval expired')")
      .run(randomUUID(), ar.task_id);
    expiredIds.push(ar.id);
  }
  return expiredIds;
}
```

#### 3. `api/routes/approval-requests.ts` (UPDATE)
```typescript
// POST /check-expiry — trigger expiry check (admin only)
approvalRequestsRouter.post('/check-expiry', requireProjectAccess('admin'), (req, res) => {
  const db = getDb();
  const expired = checkExpiredApprovals(db);
  res.status(200).json({ expired_count: expired.length, expired_ids: expired });
});
```

## Study

### Test Cases (8)
1. Expired pending approval → status set to 'expired'
2. Task transitions from approval→rework on expiry
3. Non-expired approvals untouched
4. Already approved/rejected approvals not affected
5. Multiple expired approvals processed in single call
6. POST /check-expiry returns count of expired
7. Default expires_at is 24h from creation
8. Brain thought contributed on expiry (best-effort, no failure on brain down)

## Act
- 1 migration, 1 new service, 1 route update
