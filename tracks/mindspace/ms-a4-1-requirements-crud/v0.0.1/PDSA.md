# PDSA: Requirements Table + CRUD

**Task:** ms-a4-1-requirements-crud
**Status:** Design
**Version:** v0.0.1

## Plan

Create the requirements table and basic CRUD endpoints. Requirements are project-scoped specification documents that tasks trace back to. They have human-readable IDs (e.g., REQ-BRAIN-001), versioning, and approval status.

### Problem

The mindspace API has no requirements management. Requirements are referenced in task DNA (`requirement_refs`) but don't exist as first-class entities. This task creates the table and CRUD operations. Versioning history (ms-a4-2) and task linking (ms-a4-3) are separate tasks.

### Dependencies

- **ms-a0-7-migrations** (complete): Migration infrastructure
- **ms-a2-3-access-middleware** (complete): Project access control
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**From DNA schema:**
id, project_slug, req_id_human, title, description, status, priority, created_at, created_by, current_version

**Existing patterns in codebase:**
- Projects use slug-based routes, nested routers with mergeParams
- Agent pool, members, brain are all nested under `/:slug/`
- Status CHECK constraints used in tasks table design (ms-a3-1)

**Design decisions:**
- `req_id_human` is the human-readable requirement ID (e.g., "REQ-BRAIN-001") — unique within project
- `status` for requirements: draft → active → deprecated. Simple lifecycle.
- `current_version` integer starting at 1, incremented by versioning task (ms-a4-2)
- `priority` values: low, medium, high, critical
- No DELETE endpoint — requirements should be deprecated, not deleted, for traceability

## Do

### File Changes

#### 1. `api/db/migrations/012-requirements.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  req_id_human TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'deprecated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_slug, req_id_human)
);

CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_slug);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_human_id ON requirements(req_id_human);
```

**Note:** Migration number may shift based on ordering with ms-a2-4 and ms-a3-1.

#### 2. `api/routes/requirements.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const requirementsRouter = Router({ mergeParams: true });

const VALID_STATUSES = ['draft', 'active', 'deprecated'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

requirementsRouter.use(requireProjectAccess('viewer'));

// POST / — create requirement (requires contributor)
requirementsRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { req_id_human, title, description, status, priority } = req.body;

  if (!req_id_human || !title) {
    res.status(400).json({ error: 'Missing required fields: req_id_human, title' });
    return;
  }

  const reqStatus = status || 'draft';
  if (!VALID_STATUSES.includes(reqStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const reqPriority = priority || 'medium';
  if (!VALID_PRIORITIES.includes(reqPriority)) {
    res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    return;
  }

  const db = getDb();

  // Check uniqueness of req_id_human within project
  const existing = db.prepare(
    'SELECT id FROM requirements WHERE project_slug = ? AND req_id_human = ?'
  ).get(slug, req_id_human);
  if (existing) {
    res.status(409).json({ error: `Requirement ID '${req_id_human}' already exists in this project` });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, req_id_human, title, description || null, reqStatus, reqPriority, user.id);

  const requirement = db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
  res.status(201).json(requirement);
});

// GET / — list requirements for project (optional filters: status, priority)
requirementsRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, priority } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM requirements WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    sql += ' AND priority = ?';
    params.push(priority);
  }

  sql += ' ORDER BY req_id_human ASC';
  const requirements = db.prepare(sql).all(...params);
  res.status(200).json(requirements);
});

// GET /:reqId — get single requirement (by UUID or req_id_human)
requirementsRouter.get('/:reqId', (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const db = getDb();

  // Try UUID first, then req_id_human
  let requirement = db.prepare('SELECT * FROM requirements WHERE id = ? AND project_slug = ?').get(reqId, slug);
  if (!requirement) {
    requirement = db.prepare('SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?').get(reqId, slug);
  }

  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  res.status(200).json(requirement);
});

// PUT /:reqId — update requirement (requires contributor)
requirementsRouter.put('/:reqId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, reqId } = req.params;
  const { title, description, status, priority } = req.body;
  const db = getDb();

  // Look up by UUID or req_id_human
  let existing = db.prepare('SELECT * FROM requirements WHERE id = ? AND project_slug = ?').get(reqId, slug) as any;
  if (!existing) {
    existing = db.prepare('SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?').get(reqId, slug) as any;
  }
  if (!existing) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description !== undefined ? description : existing.description;
  const updatedStatus = status || existing.status;
  const updatedPriority = priority || existing.priority;

  db.prepare(
    `UPDATE requirements SET title = ?, description = ?, status = ?, priority = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(updatedTitle, updatedDescription, updatedStatus, updatedPriority, existing.id);

  const requirement = db.prepare('SELECT * FROM requirements WHERE id = ?').get(existing.id);
  res.status(200).json(requirement);
});
```

**Key design point:** GET /:reqId supports both UUID and human-readable ID lookup. This allows `GET /api/projects/my-project/requirements/REQ-BRAIN-001` for ergonomic access.

#### 3. `api/routes/projects.ts` (UPDATE)

```typescript
// Add import
import { requirementsRouter } from './requirements.js';

// Add mount
projectsRouter.use('/:slug/requirements', requirementsRouter);
```

### No DELETE Endpoint

Requirements should be deprecated (status → deprecated), not deleted. This preserves traceability — tasks and attestations reference requirements. Deletion would break these references. If a requirement is no longer needed, set status to deprecated.

## Study

### Test Cases (16 total)

**Migration (1):**
1. requirements table exists with all columns, UNIQUE(project_slug, req_id_human) constraint

**Create requirement (5):**
2. Creates requirement with req_id_human and title, returns 201
3. Creates requirement with all optional fields
4. Returns 400 when req_id_human or title missing
5. Returns 409 for duplicate req_id_human within same project
6. Returns 400 for invalid status or priority

**List requirements (3):**
7. Returns all requirements for project, ordered by req_id_human
8. Filters by status query parameter
9. Filters by priority query parameter

**Get requirement (3):**
10. Returns requirement by UUID
11. Returns requirement by req_id_human
12. Returns 404 for non-existent requirement

**Update requirement (3):**
13. Updates title and status, returns updated requirement
14. Returns 404 for non-existent requirement
15. Returns 400 for invalid status

**Access control (1):**
16. Viewer cannot create requirements (403)

## Act

### Deployment

- Migration creates requirements table — no data migration needed
- Mount at `/api/projects/:slug/requirements` in projects.ts
- 3 files: migration (NEW), requirements.ts (NEW), projects.ts (UPDATE)
- No breaking changes to existing endpoints
- `req_id_human` is user-defined (not auto-generated) — allows convention like REQ-BRAIN-001
