# PDSA: Release Table + Create Release Endpoint

**Task:** ms-a6-1-release-table
**Status:** Design
**Version:** v0.0.1

## Plan

Create a releases table to track project releases with versioning, and a POST endpoint to create draft releases.

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table (releases reference tasks)
- **t1-3-repos-bootstrap** (complete)

### Investigation

**DNA description:** Migration: releases table (id, project_slug, version, status, created_at, created_by, sealed_at, sealed_by). POST /api/projects/:slug/releases creates draft.

**Design decisions:**
- Status flow: draft → sealed (terminal). Draft releases can be modified, sealed ones are immutable
- Version format: semver string (e.g., "1.0.0"), validated but not enforced strictly
- Unique constraint: (project_slug, version) — no duplicate versions per project
- Admin creates releases, viewer can list/get
- No DELETE — releases are historical records
- sealed_at and sealed_by are set when status changes to sealed (handled by ms-a6-3-release-sealing later)

## Do

### File Changes

#### 1. `api/db/migrations/022-releases.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sealed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  sealed_at TEXT,
  sealed_by TEXT REFERENCES users(id),
  UNIQUE(project_slug, version)
);

CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_slug);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(project_slug, status);
```

#### 2. `api/routes/releases.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const releasesRouter = Router({ mergeParams: true });

// POST / — create draft release (admin)
releasesRouter.post('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { version, notes } = req.body;

  if (!version) {
    res.status(400).json({ error: 'Missing required field: version' });
    return;
  }

  const db = getDb();

  // Check for duplicate version
  const existing = db.prepare(
    'SELECT id FROM releases WHERE project_slug = ? AND version = ?'
  ).get(slug, version);
  if (existing) {
    res.status(409).json({ error: `Release version '${version}' already exists` });
    return;
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO releases (id, project_slug, version, notes, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, slug, version, notes || null, user.id);

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(id);
  res.status(201).json(release);
});

// GET / — list releases (viewer)
releasesRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM releases WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) { sql += ' AND status = ?'; params.push(status); }

  sql += ' ORDER BY created_at DESC';
  const releases = db.prepare(sql).all(...params);
  res.status(200).json(releases);
});

// GET /:releaseId — get single release (viewer)
releasesRouter.get('/:releaseId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const db = getDb();

  const release = db.prepare(
    'SELECT * FROM releases WHERE id = ? AND project_slug = ?'
  ).get(releaseId, slug);
  if (!release) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  res.status(200).json(release);
});

// PUT /:releaseId — update draft release (admin, draft only)
releasesRouter.put('/:releaseId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const { version, notes } = req.body;
  const db = getDb();

  const existing = db.prepare(
    'SELECT * FROM releases WHERE id = ? AND project_slug = ?'
  ).get(releaseId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  if (existing.status === 'sealed') {
    res.status(400).json({ error: 'Cannot modify a sealed release' });
    return;
  }

  // Check version uniqueness if changing
  if (version && version !== existing.version) {
    const dup = db.prepare(
      'SELECT id FROM releases WHERE project_slug = ? AND version = ? AND id != ?'
    ).get(slug, version, releaseId);
    if (dup) {
      res.status(409).json({ error: `Release version '${version}' already exists` });
      return;
    }
  }

  db.prepare(
    "UPDATE releases SET version = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(version || existing.version, notes !== undefined ? notes : existing.notes, releaseId);

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);
  res.status(200).json(release);
});
```

#### 3. `api/routes/projects.ts` (UPDATE)

```typescript
import { releasesRouter } from './releases.js';
projectsRouter.use('/:slug/releases', releasesRouter);
```

## Study

### Test Cases (12 total)

**Create release (4):**
1. Creates draft release with version, returns 201
2. Creates with notes
3. Returns 409 for duplicate version
4. Returns 400 for missing version

**List releases (2):**
5. Lists all releases for project
6. Filters by status

**Get single (2):**
7. Returns release by ID
8. Returns 404 for non-existent release

**Update release (3):**
9. Updates version/notes on draft release
10. Returns 400 when trying to modify sealed release
11. Returns 409 for duplicate version on update

**Access control (1):**
12. Viewer cannot create releases (requires admin)

## Act

### Deployment

- Migration 022 creates releases table with 2 indexes
- 3 files: 022-releases.sql (NEW), releases.ts (NEW), projects.ts (UPDATE)
- Scoped per project at /api/projects/:slug/releases
