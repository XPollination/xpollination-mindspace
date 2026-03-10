# PDSA: Projects table + CRUD endpoints

**Task:** ms-a2-1-projects-crud
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The Mindspace API needs multi-project support. Projects are the top-level organizational unit — tasks, requirements, and access control all belong to a project. Before building access control (A2) or task management (A3), we need a projects table and basic CRUD endpoints.

## Requirements (REQ-ACCESS-001)

> Migration: projects table (id, slug, name, description, created_at, created_by). CRUD: POST/GET/PUT /api/projects. Slug uniqueness constraint. AC: Can create/read/update projects. Slug is URL-safe.

## Investigation

### Existing infrastructure

- **Database:** `api/db/connection.ts` — singleton `getDb()`, better-sqlite3, WAL mode, foreign_keys=ON
- **Migrations:** 001-005 exist. Next is 006.
- **Auth middleware:** `api/middleware/require-auth.ts` — `requireApiKeyOrJwt` function chains API key + JWT auth
- **Express app:** `api/server.ts` — mounts routes, exports `app`
- **Users table:** `id TEXT PRIMARY KEY, email, password_hash, name, google_id, created_at`
- **No projects table** exists yet

### Design decisions

1. **Migration 006-projects.sql** — projects table with id (UUID), slug (UNIQUE, URL-safe), name, description (nullable), created_at, created_by (FK to users).
2. **Slug validation** — enforce URL-safe slugs: lowercase alphanumeric + hyphens, 2-50 chars, no leading/trailing hyphens. Validated in route handler, not just in DB.
3. **Routes file `api/routes/projects.ts`** — standard CRUD: POST (create), GET / (list), GET /:slug (get by slug), PUT /:slug (update).
4. **Auth required** — all project endpoints require authentication via `requireApiKeyOrJwt`.
5. **created_by** — set from `req.user.id` on create, immutable.
6. **No DELETE** — projects are long-lived entities. Deletion not in requirements. Can be added later if needed.
7. **Slug lookup** — GET and PUT use slug (not id) as the URL parameter for human-readable URLs.
8. **No pagination** — for MVP, GET / returns all projects. Pagination can be added with A3.

## Design

### File 1: `api/db/migrations/006-projects.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
```

### File 2: `api/routes/projects.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const projectsRouter = Router();

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;

projectsRouter.use(requireApiKeyOrJwt);

// POST /api/projects — create project
projectsRouter.post('/', (req: Request, res: Response) => {
  const { slug, name, description } = req.body;
  const user = (req as any).user;

  if (!slug || !name) {
    res.status(400).json({ error: 'Missing required fields: slug, name' });
    return;
  }

  if (!SLUG_REGEX.test(slug)) {
    res.status(400).json({ error: 'Invalid slug: must be 2-50 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (existing) {
    res.status(409).json({ error: 'Slug already taken' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO projects (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, slug, name, description || null, user.id);

  res.status(201).json({ id, slug, name, description: description || null, created_by: user.id });
});

// GET /api/projects — list all projects
projectsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, slug, name, description, created_at, created_by FROM projects ORDER BY created_at DESC').all();
  res.status(200).json(projects);
});

// GET /api/projects/:slug — get project by slug
projectsRouter.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();
  const project = db.prepare('SELECT id, slug, name, description, created_at, created_by FROM projects WHERE slug = ?').get(slug);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.status(200).json(project);
});

// PUT /api/projects/:slug — update project
projectsRouter.put('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { name, description } = req.body;

  if (!name && description === undefined) {
    res.status(400).json({ error: 'At least one field required: name, description' });
    return;
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug) as any;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  values.push(slug);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE slug = ?`).run(...values);

  const updated = db.prepare('SELECT id, slug, name, description, created_at, created_by FROM projects WHERE slug = ?').get(slug);
  res.status(200).json(updated);
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount:
```typescript
import { projectsRouter } from './routes/projects.js';
// ...
app.use('/api/projects', projectsRouter);
```

## Files Changed

1. `api/db/migrations/006-projects.sql` — projects table with slug UNIQUE, created_by FK (NEW)
2. `api/routes/projects.ts` — CRUD endpoints with auth + slug validation (NEW)
3. `api/server.ts` — mount projectsRouter at /api/projects (UPDATE)

## Testing

1. `api/db/migrations/006-projects.sql` exists
2. Migration creates projects table
3. projects table has columns: id, slug, name, description, created_at, created_by
4. slug column is UNIQUE
5. created_by references users(id)
6. `api/routes/projects.ts` exists
7. projectsRouter exported
8. POST /api/projects creates project with 201
9. POST /api/projects requires slug and name (400 on missing)
10. POST /api/projects validates slug format (400 on invalid)
11. POST /api/projects rejects duplicate slug (409)
12. POST /api/projects sets created_by from authenticated user
13. GET /api/projects returns array of projects
14. GET /api/projects/:slug returns project by slug
15. GET /api/projects/:slug returns 404 for unknown slug
16. PUT /api/projects/:slug updates name and/or description
17. PUT /api/projects/:slug returns 404 for unknown slug
18. PUT /api/projects/:slug requires at least one field (400)
19. All endpoints require authentication (401 without auth)
20. server.ts mounts projectsRouter at /api/projects
