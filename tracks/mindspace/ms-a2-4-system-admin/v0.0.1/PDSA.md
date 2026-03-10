# PDSA: System Admin Bypass

**Task:** ms-a2-4-system-admin
**Status:** Design
**Version:** v0.0.1

## Plan

Add system admin capability so designated users (Thomas, Robin, Maria) bypass project-level access checks. System admins can access all projects regardless of membership.

### Problem

The `requireProjectAccess(minRole)` middleware checks `project_access` table for user membership. System admins should skip this check entirely and have admin-level access to all projects without explicit membership entries.

### Dependencies

- **ms-a2-3-access-middleware** (complete): The middleware to modify
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Current state:**
- `users` table has: id, email, password_hash, name, created_at — no admin flag
- `requireProjectAccess(minRole)` checks project existence, then project_access membership, returns 403 if no membership
- `req.user` is set by `requireApiKeyOrJwt` middleware with id, email, name
- No env var for admin configuration exists

**Design options:**
1. **DB column on users table** (`is_system_admin INTEGER DEFAULT 0`) — persistent, queryable
2. **Env var with email list** (`SYSTEM_ADMIN_EMAILS=thomas@...,robin@...`) — easy to change, no migration
3. **Both** — DB column as source of truth, env var for bootstrap/override

**Decision: DB column only.** A migration adds `is_system_admin` to users. This is the cleanest approach — admin status lives with the user, queryable by any middleware, and seed data (ms-a2-5) will set it for known admins. An env var adds complexity with no clear benefit since admin changes are infrequent.

## Do

### File Changes

#### 1. `api/db/migrations/011-system-admin.sql` (NEW)

```sql
ALTER TABLE users ADD COLUMN is_system_admin INTEGER NOT NULL DEFAULT 0;
```

SQLite `ALTER TABLE ADD COLUMN` is safe and non-destructive. Existing rows get default value 0.

#### 2. `api/middleware/require-project-access.ts` (UPDATE)

Add system admin check early in the middleware, before project_access lookup:

```typescript
export function requireProjectAccess(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Project slug is required' });
      return;
    }

    const db = getDb();

    // Check project exists (even admins can't access non-existent projects)
    const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // System admin bypass — check users table
    const userRow = db.prepare('SELECT is_system_admin FROM users WHERE id = ?').get(user.id) as any;
    if (userRow?.is_system_admin === 1) {
      (req as any).projectAccess = {
        role: 'admin',
        level: ROLE_HIERARCHY['admin'],
        project_slug: slug,
        is_system_admin: true
      };
      next();
      return;
    }

    // Normal project_access check
    const access = db.prepare(
      'SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?'
    ).get(user.id, slug) as any;

    if (!access) {
      res.status(403).json({ error: 'Access denied: not a member of this project' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[access.role] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: `Insufficient role: requires ${minRole}, you have ${access.role}` });
      return;
    }

    (req as any).projectAccess = {
      role: access.role,
      level: userLevel,
      project_slug: slug
    };

    next();
  };
}
```

**Key design points:**
- Project existence check happens BEFORE admin bypass — even admins get 404 for non-existent projects
- Admin bypass sets `role: 'admin'` and `is_system_admin: true` on `req.projectAccess`
- `is_system_admin: true` flag lets downstream handlers distinguish between project admin and system admin if needed
- No changes to error responses for non-admin users

### Response Behavior

| User Type | Project Exists | Has Access | Result |
|-----------|---------------|------------|--------|
| System admin | Yes | N/A | Pass (admin level, is_system_admin: true) |
| System admin | No | N/A | 404 |
| Regular user | Yes | Yes (sufficient) | Pass (actual role) |
| Regular user | Yes | Yes (insufficient) | 403 |
| Regular user | Yes | No | 403 |
| Regular user | No | N/A | 404 |

## Study

### Test Cases (12 total)

**Migration (1):**
1. users table has is_system_admin column with default 0

**System admin bypass (6):**
2. System admin can access project without project_access entry
3. System admin gets role 'admin' and level 2 in req.projectAccess
4. System admin gets is_system_admin: true in req.projectAccess
5. System admin gets 404 for non-existent project (not bypassed)
6. Non-admin user without project_access gets 403 (unchanged behavior)
7. is_system_admin = 0 does not grant bypass (explicit check)

**Interaction with existing behavior (5):**
8. Regular user with viewer role still gets 403 for admin-required endpoints
9. Regular user with admin role still works normally (not affected by feature)
10. Unauthenticated request still returns 401
11. Missing project slug still returns 400
12. System admin projectAccess does not include is_system_admin when user is regular admin

## Act

### Deployment

- Migration 011 adds column — safe, non-destructive ALTER TABLE
- No data migration needed — all existing users default to is_system_admin = 0
- Seed data task (ms-a2-5-seed-data) will set is_system_admin = 1 for Thomas, Robin, Maria
- Until seed data runs, no users are system admins — existing behavior unchanged
