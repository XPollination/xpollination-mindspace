# PDSA: API Database Bootstrap — Seed FK Dependencies

**Task:** `graph-bootstrap-schema`
**Version:** v0.0.1
**Status:** Design

## Plan

Seed the minimum records (system user + mindspace project) needed to satisfy FK constraints for hierarchy tables.

### FK Dependency Chain

1. `users` — no FKs (seed first)
2. `projects` — FK to `users.id` via `created_by` (seed second)
3. `missions` — no FKs to users/projects (no seed needed)
4. `capabilities` — FK to `missions.id` only (no seed needed)
5. `requirements` — FK to `projects.slug` AND `users.id` (satisfied by steps 1+2)

### Migration: `046-bootstrap-seed.sql`

```sql
-- Bootstrap seed: system user + mindspace project
-- Satisfies FK constraints for hierarchy tables
-- Idempotent: INSERT OR IGNORE

-- Step 1: System user (no password, cannot login)
INSERT OR IGNORE INTO users (id, email, password_hash, name)
VALUES ('system', 'system@mindspace.local', 'nologin', 'System');

-- Step 2: Mindspace project (FK to system user)
INSERT OR IGNORE INTO projects (id, slug, name, description, created_by)
VALUES ('proj-mindspace', 'mindspace', 'Mindspace', 'XPollination Mindspace platform', 'system');
```

## Do

DEV creates `api/db/migrations/046-bootstrap-seed.sql` with the SQL above.

## Study

Verify:
- `SELECT * FROM users WHERE id='system'` returns 1 row
- `SELECT * FROM projects WHERE slug='mindspace'` returns 1 row
- `INSERT INTO requirements (..., project_slug, created_by) VALUES (..., 'mindspace', 'system')` succeeds (FK satisfied)
- Running migration twice is safe (INSERT OR IGNORE)

## Act

### Design Decisions

1. **User ID = `system`**: Matches existing convention from migration 045.
2. **Project slug = `mindspace`**: Human-readable, platform name. FK target for `requirements.project_slug`.
3. **Project ID = `proj-mindspace`**: Distinct from `proj-system` (migration 045 legacy).
4. **`password_hash = nologin`**: System user cannot authenticate.
5. **INSERT OR IGNORE**: Idempotent, safe for multiple runs.

### Relationship to Migration 045

Migration 045 already seeds `user=system` and `project=system-default`. This migration adds `project=mindspace` as the proper hierarchy target. The system user is shared (same ID, INSERT OR IGNORE is safe).
