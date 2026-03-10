# PDSA: Marketplace Requests Table + CRUD

**Task:** ms-a14-2-marketplace-requests
**Status:** Design
**Version:** v0.0.1

## Plan

Create a marketplace requests system where projects can request needed features or capabilities from other projects in the ecosystem.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** Migration: marketplace_requests table. CRUD under /api/marketplace/requests. Projects can request needed features.

**Design decisions:**
- Requests are per-project: a project requests what it needs
- Fields: title, description, category, status (open/matched/fulfilled/closed), project_slug (requester)
- Same category set as announcements: feature, integration, service, data
- Cross-project endpoint at /api/marketplace/requests (not under /:slug)
- Any authenticated user can list/get, project admins create/update for their project
- No DELETE — use status:closed

## Do

### File Changes

#### 1. `api/db/migrations/020-marketplace-requests.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS marketplace_requests (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'feature' CHECK(category IN ('feature', 'integration', 'service', 'data')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'matched', 'fulfilled', 'closed')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_marketplace_req_project ON marketplace_requests(project_slug);
CREATE INDEX idx_marketplace_req_status ON marketplace_requests(status);
CREATE INDEX idx_marketplace_req_category ON marketplace_requests(category);
```

#### 2. `api/routes/marketplace-requests.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireAuth } from '../middleware/require-auth.js';

export const marketplaceRequestsRouter = Router();

const VALID_CATEGORIES = ['feature', 'integration', 'service', 'data'];
const VALID_STATUSES = ['open', 'matched', 'fulfilled', 'closed'];

// GET / — list requests (authenticated)
marketplaceRequestsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const { status, category, project_slug } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM marketplace_requests WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (project_slug) { sql += ' AND project_slug = ?'; params.push(project_slug); }

  sql += ' ORDER BY created_at DESC';
  const requests = db.prepare(sql).all(...params);
  res.status(200).json(requests);
});

// GET /:id — get single request
marketplaceRequestsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const request = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  res.status(200).json(request);
});

// POST / — create request (admin of requesting project)
marketplaceRequestsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { project_slug, title, description, category } = req.body;

  if (!project_slug || !title) {
    res.status(400).json({ error: 'Missing required fields: project_slug, title' });
    return;
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  const db = getDb();
  const access = db.prepare('SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?').get(user.id, project_slug) as any;
  if (!access || access.role !== 'admin') {
    res.status(403).json({ error: 'Must be admin of the requesting project' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO marketplace_requests (id, project_slug, title, description, category, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, project_slug, title, description || null, category || 'feature', user.id);

  const created = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  res.status(201).json(created);
});

// PUT /:id — update request (admin of requesting project)
marketplaceRequestsRouter.put('/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title, description, category, status } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const access = db.prepare('SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?').get(user.id, existing.project_slug) as any;
  if (!access || access.role !== 'admin') {
    res.status(403).json({ error: 'Must be admin of the requesting project' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  db.prepare(
    "UPDATE marketplace_requests SET title = ?, description = ?, category = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title || existing.title, description !== undefined ? description : existing.description, category || existing.category, status || existing.status, id);

  const updated = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  res.status(200).json(updated);
});
```

#### 3. `api/server.ts` (UPDATE)

```typescript
import { marketplaceRequestsRouter } from './routes/marketplace-requests.js';
app.use('/api/marketplace/requests', marketplaceRequestsRouter);
```

## Study

### Test Cases (14 total)

**Create request (4):**
1. Creates request with project_slug and title, returns 201
2. Creates with all fields (description, category)
3. Returns 403 when user is not admin of requesting project
4. Returns 400 for invalid category

**List requests (3):**
5. Lists all requests
6. Filters by status, category, project_slug
7. Returns empty array when no requests

**Get single (2):**
8. Returns request by ID
9. Returns 404 for non-existent ID

**Update request (3):**
10. Updates title/description/category/status
11. Returns 403 when user is not admin
12. Returns 400 for invalid status

**Access control (2):**
13. Unauthenticated user cannot access
14. Non-admin can list/get but not create/update

## Act

### Deployment

- Migration 020 creates marketplace_requests table with 3 indexes
- 3 files: 020-marketplace-requests.sql (NEW), marketplace-requests.ts (NEW), server.ts (UPDATE)
- Cross-project endpoint at /api/marketplace/requests
- Statuses: open → matched → fulfilled → closed
