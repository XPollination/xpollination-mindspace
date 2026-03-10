# PDSA: Marketplace Announcements Table + CRUD

**Task:** ms-a14-1-marketplace-announcements
**Status:** Design
**Version:** v0.0.1

## Plan

Create a marketplace announcements system where projects can announce available features or capabilities to other projects in the ecosystem.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table
- **ms-a4-1-requirements-crud** (complete): Requirements table
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** Migration: marketplace_announcements table. CRUD under /api/marketplace/announcements. Projects can announce available features.

**Design decisions:**
- Announcements are per-project: a project announces what it can offer
- Fields: title, description, category, status (active/expired/withdrawn), project_slug (announcer)
- Category examples: "feature", "integration", "service", "data"
- Not scoped under /:slug — marketplace is cross-project, mounted at /api/marketplace/announcements
- Any authenticated user can list/get, but only project admins can create/update for their project
- No DELETE — use status:withdrawn instead (audit trail)

## Do

### File Changes

#### 1. `api/db/migrations/019-marketplace-announcements.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS marketplace_announcements (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'feature' CHECK(category IN ('feature', 'integration', 'service', 'data')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'withdrawn')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_marketplace_ann_project ON marketplace_announcements(project_slug);
CREATE INDEX idx_marketplace_ann_status ON marketplace_announcements(status);
CREATE INDEX idx_marketplace_ann_category ON marketplace_announcements(category);
```

#### 2. `api/routes/marketplace-announcements.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireAuth } from '../middleware/require-auth.js';

export const marketplaceAnnouncementsRouter = Router();

const VALID_CATEGORIES = ['feature', 'integration', 'service', 'data'];
const VALID_STATUSES = ['active', 'expired', 'withdrawn'];

// GET / — list announcements (authenticated)
marketplaceAnnouncementsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const { status, category, project_slug } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM marketplace_announcements WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (project_slug) { sql += ' AND project_slug = ?'; params.push(project_slug); }

  sql += ' ORDER BY created_at DESC';
  const announcements = db.prepare(sql).all(...params);
  res.status(200).json(announcements);
});

// GET /:id — get single announcement
marketplaceAnnouncementsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }
  res.status(200).json(announcement);
});

// POST / — create announcement (must be admin of the announcing project)
marketplaceAnnouncementsRouter.post('/', requireAuth, (req: Request, res: Response) => {
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

  // Verify user has admin access to the project
  const access = db.prepare('SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?').get(user.id, project_slug) as any;
  if (!access || access.role !== 'admin') {
    res.status(403).json({ error: 'Must be admin of the announcing project' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO marketplace_announcements (id, project_slug, title, description, category, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, project_slug, title, description || null, category || 'feature', user.id);

  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  res.status(201).json(announcement);
});

// PUT /:id — update announcement (admin of announcing project)
marketplaceAnnouncementsRouter.put('/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title, description, category, status } = req.body;

  const db = getDb();
  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id) as any;
  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  // Verify admin access
  const access = db.prepare('SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?').get(user.id, announcement.project_slug) as any;
  if (!access || access.role !== 'admin') {
    res.status(403).json({ error: 'Must be admin of the announcing project' });
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
    "UPDATE marketplace_announcements SET title = ?, description = ?, category = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title || announcement.title, description !== undefined ? description : announcement.description, category || announcement.category, status || announcement.status, id);

  const updated = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(id);
  res.status(200).json(updated);
});
```

#### 3. `api/server.ts` (UPDATE)

```typescript
import { marketplaceAnnouncementsRouter } from './routes/marketplace-announcements.js';
app.use('/api/marketplace/announcements', marketplaceAnnouncementsRouter);
```

## Study

### Test Cases (14 total)

**Create announcement (4):**
1. Creates announcement with project_slug and title, returns 201
2. Creates with all fields (description, category)
3. Returns 403 when user is not admin of announcing project
4. Returns 400 for invalid category

**List announcements (3):**
5. Lists all announcements
6. Filters by status, category, project_slug
7. Returns empty array when no announcements

**Get single (2):**
8. Returns announcement by ID
9. Returns 404 for non-existent ID

**Update announcement (3):**
10. Updates title/description/category/status
11. Returns 403 when user is not admin of project
12. Returns 400 for invalid status

**Access control (2):**
13. Unauthenticated user cannot access any endpoint
14. Non-admin can list/get but not create/update

## Act

### Deployment

- Migration 019 creates marketplace_announcements table with 3 indexes
- 3 files: 019-marketplace-announcements.sql (NEW), marketplace-announcements.ts (NEW), server.ts (UPDATE)
- Cross-project endpoint at /api/marketplace/announcements
- No DELETE — use status:withdrawn
