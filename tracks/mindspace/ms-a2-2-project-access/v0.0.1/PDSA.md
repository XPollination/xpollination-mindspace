# PDSA: Project access table + membership endpoints

**Task:** ms-a2-2-project-access
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Projects exist (ms-a2-1-projects-crud) but have no access control. Any authenticated user can read/modify any project. We need a project_access table to track membership and roles (admin/contributor/viewer), plus endpoints to add, list, and remove members.

## Requirements (REQ-ACCESS-001)

> Migration: project_access table (id, user_id, project_slug, role [admin/contributor/viewer], granted_at, granted_by). Endpoints: POST/GET/DELETE /api/projects/:slug/members. AC: Can add/list/remove project members.

## Investigation

### Existing infrastructure

- **Projects table:** `api/db/migrations/006-projects.sql` — id, slug (UNIQUE), name, description, created_at, created_by (FK→users)
- **Users table:** `api/db/migrations/001-users.sql` — id, email, password_hash, name, created_at
- **Auth middleware:** `requireApiKeyOrJwt` — sets `req.user` with `id`, `email`, `name`
- **Projects routes:** `api/routes/projects.ts` — CRUD at /api/projects, auth required
- **Server:** `api/server.ts` — mounts projectsRouter at /api/projects
- **Next migration:** 007 (006 is projects)

### Design decisions

1. **Migration 007-project-access.sql** — project_access table with composite UNIQUE on (user_id, project_slug) to prevent duplicate memberships.
2. **project_slug FK** — references projects(slug) not projects(id), matching URL-based lookup pattern.
3. **Roles:** `admin`, `contributor`, `viewer` — validated in route handler, not SQL CHECK (easier to extend).
4. **Nested routes** — POST/GET/DELETE under `/api/projects/:slug/members`, mounted on projectsRouter (keeps project context).
5. **Project creator auto-admin** — NOT in this task. Creator gets no implicit access entry (can be added in ms-a2-3 or seed data). Keeps this task focused on the access table mechanics.
6. **Authorization** — This task does NOT enforce "only admins can add members". That's ms-a2-3 (access middleware). All authenticated users can manage members for now.
7. **DELETE by user_id** — DELETE /api/projects/:slug/members/:userId removes a specific member. Body-based DELETE avoided for REST conventions.

## Design

### File 1: `api/db/migrations/007-project-access.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS project_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  role TEXT NOT NULL DEFAULT 'viewer',
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE(user_id, project_slug)
);

CREATE INDEX IF NOT EXISTS idx_project_access_project ON project_access(project_slug);
CREATE INDEX IF NOT EXISTS idx_project_access_user ON project_access(user_id);
```

### File 2: `api/routes/project-members.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const projectMembersRouter = Router({ mergeParams: true });

const VALID_ROLES = ['admin', 'contributor', 'viewer'];

projectMembersRouter.use(requireApiKeyOrJwt);

// POST /api/projects/:slug/members — add member
projectMembersRouter.post('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { user_id, role } = req.body;
  const grantedBy = (req as any).user;

  if (!user_id) {
    res.status(400).json({ error: 'Missing required field: user_id' });
    return;
  }

  const memberRole = role || 'viewer';
  if (!VALID_ROLES.includes(memberRole)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const db = getDb();

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Verify user exists
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Check duplicate
  const existing = db.prepare('SELECT id FROM project_access WHERE user_id = ? AND project_slug = ?').get(user_id, slug);
  if (existing) {
    res.status(409).json({ error: 'User already has access to this project' });
    return;
  }

  const id = randomUUID();
  db.prepare('INSERT INTO project_access (id, user_id, project_slug, role, granted_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, user_id, slug, memberRole, grantedBy.id);

  const member = db.prepare('SELECT pa.id, pa.user_id, u.name, u.email, pa.role, pa.granted_at, pa.granted_by FROM project_access pa JOIN users u ON pa.user_id = u.id WHERE pa.id = ?').get(id);
  res.status(201).json(member);
});

// GET /api/projects/:slug/members — list members
projectMembersRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const members = db.prepare(
    'SELECT pa.id, pa.user_id, u.name, u.email, pa.role, pa.granted_at, pa.granted_by FROM project_access pa JOIN users u ON pa.user_id = u.id WHERE pa.project_slug = ? ORDER BY pa.granted_at ASC'
  ).all(slug);
  res.status(200).json(members);
});

// DELETE /api/projects/:slug/members/:userId — remove member
projectMembersRouter.delete('/:userId', (req: Request, res: Response) => {
  const { slug, userId } = req.params;
  const db = getDb();

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const result = db.prepare('DELETE FROM project_access WHERE user_id = ? AND project_slug = ?').run(userId, slug);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Member not found in this project' });
    return;
  }

  res.status(200).json({ removed: true, user_id: userId, project_slug: slug });
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount:
```typescript
import { projectMembersRouter } from './routes/project-members.js';
// ...
app.use('/api/projects/:slug/members', projectMembersRouter);
```

## Files Changed

1. `api/db/migrations/007-project-access.sql` — project_access table with UNIQUE(user_id, project_slug), FK to users and projects (NEW)
2. `api/routes/project-members.ts` — POST/GET/DELETE membership endpoints with auth (NEW)
3. `api/server.ts` — mount projectMembersRouter at /api/projects/:slug/members (UPDATE)

## Testing

1. `api/db/migrations/007-project-access.sql` exists
2. Migration creates project_access table
3. project_access has columns: id, user_id, project_slug, role, granted_at, granted_by
4. UNIQUE constraint on (user_id, project_slug)
5. user_id references users(id)
6. project_slug references projects(slug)
7. granted_by references users(id)
8. `api/routes/project-members.ts` exists
9. projectMembersRouter exported
10. POST /api/projects/:slug/members adds member with 201
11. POST requires user_id (400 on missing)
12. POST validates role (400 on invalid role)
13. POST defaults role to 'viewer' when not specified
14. POST returns 404 for unknown project
15. POST returns 404 for unknown user
16. POST returns 409 for duplicate membership
17. POST sets granted_by from authenticated user
18. GET /api/projects/:slug/members returns array of members with user info
19. GET returns 404 for unknown project
20. DELETE /api/projects/:slug/members/:userId removes member with 200
21. DELETE returns 404 for unknown project
22. DELETE returns 404 when member not found
23. All endpoints require authentication (401 without auth)
24. server.ts mounts projectMembersRouter at /api/projects/:slug/members
