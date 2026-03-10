# PDSA: Access control middleware

**Task:** ms-a2-3-access-middleware
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Currently all authenticated users have unrestricted access to all project resources. The `requireApiKeyOrJwt` middleware only verifies identity but not authorization. A viewer can modify projects, add members, or provision brain collections. We need role-based access control per project.

## Requirements (AC from task DNA)

1. Express middleware: `requireProjectAccess(minRole)` where `minRole` is 'viewer' | 'contributor' | 'admin'
2. Checks `project_access` table for current user + project slug from route params
3. Returns 403 if user has insufficient role
4. Viewer can't write (POST/PUT/DELETE on protected routes)
5. Contributor can't admin (add/remove members, provision brain)
6. Unauthorized (no membership) returns 403

## Investigation

### Existing auth layer

`api/middleware/require-auth.ts` exports `requireApiKeyOrJwt` which:
- Tries API key auth first, then JWT
- Sets `(req as any).user = { id, email, name }` on success
- Returns 401 if neither succeeds
- Used by all routers (projects, members, agents, brain)

### Project access table (007-project-access.sql)

```sql
CREATE TABLE project_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'contributor', 'viewer')),
  granted_at TEXT, granted_by TEXT,
  UNIQUE(user_id, project_slug)
);
```

### Route structure

All project-scoped routes use `:slug` parameter:
- `projectsRouter.use('/:slug/members', membersRouter)` — `mergeParams: true`
- `projectsRouter.use('/:slug/brain', brainRouter)` — `mergeParams: true`
- `projectsRouter.get('/:slug')`, `projectsRouter.put('/:slug')`

The `:slug` parameter is available in `req.params.slug` on all nested routes.

### Role hierarchy

`admin > contributor > viewer` — an admin has all contributor and viewer permissions. A contributor has viewer permissions.

### Where to apply

The middleware should be applied per-route (not globally) since some routes need different minimum roles:
- GET operations: `viewer` minimum
- POST/PUT/DELETE on project data: `contributor` minimum
- Member management, brain provisioning: `admin` minimum

## Design

### File 1: `api/middleware/require-project-access.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  contributor: 1,
  admin: 2
};

export function requireProjectAccess(minRole: 'viewer' | 'contributor' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Project slug required' });
      return;
    }

    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check user's project access
    const access = db.prepare(
      'SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?'
    ).get(user.id, slug) as { role: string } | undefined;

    if (!access) {
      res.status(403).json({ error: 'Access denied: not a member of this project' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[access.role] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: `Access denied: requires ${minRole} role, you have ${access.role}`
      });
      return;
    }

    // Attach project access info for downstream use
    (req as any).projectAccess = { role: access.role, projectSlug: slug };
    next();
  };
}
```

Key design decisions:
- Returns a middleware function (factory pattern) — same pattern as `express.json()`
- Role hierarchy via numeric levels — extensible, simple comparison
- Checks project existence (404) before access (403) — prevents information leakage about non-existent projects
- Attaches access info to `req.projectAccess` for downstream handlers
- Does NOT replace `requireApiKeyOrJwt` — used in addition to it (auth + authz are separate concerns)

### File 2: Apply middleware to routes (NO file changes in this task)

The middleware is created in this task but **applied** route-by-route in future tasks or by dev as part of integration. The DNA AC focuses on the middleware itself and its correctness. Route application would be a follow-up concern since changing existing routes could break other in-flight tasks.

However, usage example for reference:
```typescript
// In members.ts — admin only
membersRouter.post('/', requireProjectAccess('admin'), (req, res) => { ... });
membersRouter.delete('/:userId', requireProjectAccess('admin'), (req, res) => { ... });

// In brain.ts — admin only
brainRouter.post('/provision', requireProjectAccess('admin'), (req, res) => { ... });
```

## Files Changed

1. `api/middleware/require-project-access.ts` — New middleware factory function (NEW)

## Testing

1. Returns 401 when no user on request (not authenticated)
2. Returns 400 when no slug in route params
3. Returns 404 when project doesn't exist
4. Returns 403 when user has no project_access record
5. Returns 403 when viewer tries to access contributor-minimum route
6. Returns 403 when viewer tries to access admin-minimum route
7. Returns 403 when contributor tries to access admin-minimum route
8. Allows admin to access admin-minimum route
9. Allows admin to access contributor-minimum route
10. Allows admin to access viewer-minimum route
11. Allows contributor to access contributor-minimum route
12. Allows contributor to access viewer-minimum route
13. Allows viewer to access viewer-minimum route
14. Sets `req.projectAccess` with role and slug on success
15. Error message includes required role and actual role
