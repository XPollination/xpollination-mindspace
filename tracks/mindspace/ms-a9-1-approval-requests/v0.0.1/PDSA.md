# PDSA: Approval Requests Table + Creation on Gated Transition

**Task:** ms-a9-1-approval-requests
**Status:** Design
**Version:** v0.0.1

## Plan

Create an approval_requests table. When a task transition hits a gated state (active→approval), automatically create an approval request record. Return 202 with approval ID.

### Dependencies

- **ms-a3-2-state-machine** (complete): Transition validation
- **ms-a3-1-tasks-crud** (complete): Tasks table

### Investigation

**DNA description:** Migration: approval_requests table. On gated transition: create request, return 202 with approval ID.

**Design decisions:**
- approval_requests table: id, task_id, project_slug, requested_by, requested_at, status (pending/approved/rejected), decided_by, decided_at, reason
- Auto-create on active→approval transition (in task-transitions.ts)
- Return 202 Accepted (instead of 200) to signal "accepted but awaiting approval"
- Include approval_request_id in the response
- Approval granting/rejecting is handled by ms-a9-2 (separate task)

## Do

### File Changes

#### 1. `api/db/migrations/022-approval-requests.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  decided_by TEXT,
  decided_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approval_req_task ON approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_req_project ON approval_requests(project_slug);
CREATE INDEX IF NOT EXISTS idx_approval_req_status ON approval_requests(status);
```

#### 2. `api/routes/task-transitions.ts` (UPDATE)

After the transition to 'approval' is recorded, auto-create approval request:

```typescript
// After updating task status, if to_status === 'approval':
if (to_status === 'approval') {
  const approvalId = randomUUID();
  db.prepare(
    'INSERT INTO approval_requests (id, task_id, project_slug, requested_by) VALUES (?, ?, ?, ?)'
  ).run(approvalId, taskId, slug, actor || 'unknown');

  res.status(202).json({
    transition: { from: task.status, to: to_status },
    role: newRole || task.current_role,
    task: updatedTask,
    approval_request_id: approvalId
  });
  return;
}
```

#### 3. `api/routes/approval-requests.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const approvalRequestsRouter = Router({ mergeParams: true });

// GET / — list approval requests for project (viewer)
approvalRequestsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status } = req.query;
  const db = getDb();

  let sql = 'SELECT ar.*, t.title as task_title FROM approval_requests ar JOIN tasks t ON t.id = ar.task_id WHERE ar.project_slug = ?';
  const params: any[] = [slug];

  if (status) { sql += ' AND ar.status = ?'; params.push(status); }

  sql += ' ORDER BY ar.created_at DESC';
  const requests = db.prepare(sql).all(...params);
  res.status(200).json(requests);
});

// GET /:approvalId — get single approval request (viewer)
approvalRequestsRouter.get('/:approvalId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, approvalId } = req.params;
  const db = getDb();

  const request = db.prepare(
    'SELECT ar.*, t.title as task_title FROM approval_requests ar JOIN tasks t ON t.id = ar.task_id WHERE ar.id = ? AND ar.project_slug = ?'
  ).get(approvalId, slug);
  if (!request) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  res.status(200).json(request);
});
```

#### 4. `api/routes/projects.ts` (UPDATE)

```typescript
import { approvalRequestsRouter } from './approval-requests.js';
projectsRouter.use('/:slug/approvals', approvalRequestsRouter);
```

## Study

### Test Cases (10 total)

**Auto-creation (3):**
1. Transition to approval auto-creates approval_request with status=pending
2. Response is 202 with approval_request_id
3. Approval request has correct task_id, project_slug, requested_by

**List approvals (3):**
4. Lists all approval requests for project
5. Filters by status (pending/approved/rejected)
6. Includes task_title in response

**Get single (2):**
7. Returns approval request by ID
8. Returns 404 for non-existent

**No auto-creation for non-gated transitions (2):**
9. Transition to review does NOT create approval request
10. Transition to active does NOT create approval request

## Act

### Deployment

- Migration 022 creates approval_requests table with 3 indexes
- 4 files: 022-approval-requests.sql (NEW), approval-requests.ts (NEW), task-transitions.ts (UPDATE), projects.ts (UPDATE)
- Note: release migration also uses 022. If both deploy, one should be renumbered to 023. Liaison/dev will coordinate.
