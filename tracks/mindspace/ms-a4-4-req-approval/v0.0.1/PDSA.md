# PDSA: Requirement Approval Workflow

**Task:** ms-a4-4-req-approval
**Status:** Design
**Version:** v0.0.1

## Plan

Add requirement status transitions with a human gate for draft→approved. Uses a time-bonded approval token pattern.

### Dependencies

- **ms-a4-1-requirements-crud** (complete): Requirements table with status (draft/active/deprecated)
- **ms-a4-2-req-versioning** (complete): Requirement versions

### Investigation

**DNA description:** Requirement status transitions: draft → approved (requires human gate). Uses same approval token pattern as task transitions.

**Existing requirement statuses:** draft, active, deprecated (013-requirements.sql)

**Design decisions:**
- Add 'approved' to requirement status CHECK constraint (migration ALTER)
- New endpoint: POST /api/projects/:slug/requirements/:reqId/approve
- Approval creates a time-bonded token (valid for 1 hour)
- Token must be confirmed within TTL to complete approval
- Approval sets status from draft→active (approved requirements become active)
- Only admin can approve requirements
- Records approval in requirement_versions history
- Token stored in a new requirement_approvals table (lightweight, reuses pattern)

## Do

### File Changes

#### 1. `api/db/migrations/023-requirement-approvals.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS requirement_approvals (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'expired')),
  requested_by TEXT NOT NULL REFERENCES users(id),
  confirmed_by TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_req_approvals_req ON requirement_approvals(requirement_id);
CREATE INDEX IF NOT EXISTS idx_req_approvals_token ON requirement_approvals(token);
```

#### 2. `api/routes/requirement-approvals.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const requirementApprovalsRouter = Router({ mergeParams: true });

// POST / — request approval for a requirement (admin)
requirementApprovalsRouter.post('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  // Dual lookup
  let requirement = db.prepare(
    'SELECT * FROM requirements WHERE id = ? AND project_slug = ?'
  ).get(reqId, slug) as any;
  if (!requirement) {
    requirement = db.prepare(
      'SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?'
    ).get(reqId, slug) as any;
  }
  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  if (requirement.status !== 'draft') {
    res.status(400).json({ error: `Requirement is in '${requirement.status}' status, must be 'draft' to approve` });
    return;
  }

  const id = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour TTL

  db.prepare(
    'INSERT INTO requirement_approvals (id, requirement_id, project_slug, token, requested_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, requirement.id, slug, token, user.id, expiresAt);

  res.status(202).json({ approval_id: id, token, expires_at: expiresAt });
});

// POST /confirm — confirm approval with token (admin)
requirementApprovalsRouter.post('/confirm', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { token } = req.body;
  const db = getDb();

  if (!token) {
    res.status(400).json({ error: 'Missing required field: token' });
    return;
  }

  const approval = db.prepare(
    'SELECT * FROM requirement_approvals WHERE token = ? AND project_slug = ?'
  ).get(token, slug) as any;

  if (!approval) {
    res.status(404).json({ error: 'Approval token not found' });
    return;
  }

  if (approval.status !== 'pending') {
    res.status(400).json({ error: `Approval is already '${approval.status}'` });
    return;
  }

  if (new Date(approval.expires_at) < new Date()) {
    db.prepare("UPDATE requirement_approvals SET status = 'expired' WHERE id = ?").run(approval.id);
    res.status(400).json({ error: 'Approval token has expired' });
    return;
  }

  // Confirm approval
  db.prepare(
    "UPDATE requirement_approvals SET status = 'confirmed', confirmed_by = ?, confirmed_at = datetime('now') WHERE id = ?"
  ).run(user.id, approval.id);

  // Transition requirement draft → active
  db.prepare(
    "UPDATE requirements SET status = 'active', updated_at = datetime('now') WHERE id = ?"
  ).run(approval.requirement_id);

  // Record in version history
  const req_record = db.prepare('SELECT * FROM requirements WHERE id = ?').get(approval.requirement_id) as any;
  db.prepare(
    `INSERT INTO requirement_versions (id, requirement_id, version_number, title, description, status, priority, change_summary, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), approval.requirement_id, parseInt(req_record.current_version || '0', 10) + 1,
    req_record.title, req_record.description, 'active', req_record.priority, 'Requirement approved', user.id);

  const requirement = db.prepare('SELECT * FROM requirements WHERE id = ?').get(approval.requirement_id);
  res.status(200).json({ approval_id: approval.id, requirement });
});
```

#### 3. `api/routes/requirements.ts` (UPDATE)

```typescript
import { requirementApprovalsRouter } from './requirement-approvals.js';
requirementsRouter.use('/:reqId/approve', requirementApprovalsRouter);
```

## Study

### Test Cases (12 total)

**Request approval (3):**
1. Creates approval request for draft requirement, returns 202 with token
2. Returns 400 for non-draft requirement
3. Returns 404 for non-existent requirement

**Confirm approval (4):**
4. Confirms with valid token, sets requirement status to active
5. Returns 400 for expired token
6. Returns 400 for already confirmed/expired approval
7. Returns 404 for invalid token

**Version history (2):**
8. Confirmation records version history entry
9. Version history includes 'Requirement approved' change_summary

**Access control (2):**
10. Non-admin cannot request approval
11. Non-admin cannot confirm approval

**Edge case (1):**
12. Multiple pending approvals for same requirement — only first confirm succeeds

## Act

### Deployment

- Migration 023 creates requirement_approvals table with 2 indexes
- 3 files: 023-requirement-approvals.sql (NEW), requirement-approvals.ts (NEW), requirements.ts (UPDATE)
- POST /api/projects/:slug/requirements/:reqId/approve — request
- POST /api/projects/:slug/requirements/:reqId/approve/confirm — confirm with token
