# PDSA: Seed Data

**Task:** ms-a2-5-seed-data
**Status:** Design
**Version:** v0.0.1

## Plan

Create a seed script that populates initial data for a fresh install: admin users, projects, and project access entries.

### Dependencies

- **ms-a2-4-system-admin** (complete): is_system_admin column on users table
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Tables to seed:**
- `users` — Thomas, Robin, Maria with is_system_admin=1
- `projects` — xpollination-mcp-server, pichler-mindspace
- `project_access` — all admins get admin role on all projects
- `api_keys` — each admin needs an API key for agent auth

**Existing schema:**
- users: id, email, password_hash, name, created_at, is_system_admin
- projects: id, slug, name, description, created_at, created_by
- project_access: id, user_id, project_slug, role, created_at
- api_keys: id, user_id, key_hash, name, revoked_at, created_at

**Design decision: migration vs script**
A standalone seed script (`api/db/seed.ts`) that can be run via `node api/db/seed.js`. Idempotent — uses INSERT OR IGNORE so re-running is safe. Not a migration — seed data is environment-specific, migrations are schema-only.

## Do

### File Changes

#### 1. `api/db/seed.ts` (NEW)

```typescript
import { randomUUID, createHash } from 'node:crypto';
import { getDb } from './connection.js';

const ADMIN_USERS = [
  { email: 'thomas@pichler.dev', name: 'Thomas Pichler' },
  { email: 'robin@pichler.dev', name: 'Robin Pichler' },
  { email: 'maria@pichler.dev', name: 'Maria Pichler' },
];

const PROJECTS = [
  { slug: 'xpollination-mcp-server', name: 'XPollination MCP Server', description: 'Content pipeline + PM tool' },
  { slug: 'pichler-mindspace', name: 'Pichler Mindspace', description: 'Shared knowledge and collaboration platform' },
];

export function seed(): void {
  const db = getDb();

  // 1. Create admin users (idempotent via UNIQUE email)
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, password_hash, name, is_system_admin)
     VALUES (?, ?, ?, ?, 1)`
  );

  const userIds: Record<string, string> = {};
  for (const user of ADMIN_USERS) {
    const id = randomUUID();
    // password_hash is a placeholder — auth is via API keys, not passwords
    const passwordHash = createHash('sha256').update(`seed-${user.email}`).digest('hex');
    insertUser.run(id, user.email, passwordHash, user.name);

    // Get actual ID (may differ if already exists)
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email) as any;
    userIds[user.email] = existing.id;

    // Ensure is_system_admin is set even if user already existed
    db.prepare('UPDATE users SET is_system_admin = 1 WHERE email = ?').run(user.email);
  }

  // 2. Create projects (idempotent via UNIQUE slug)
  const insertProject = db.prepare(
    'INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)'
  );

  const firstAdminId = userIds[ADMIN_USERS[0].email];
  for (const project of PROJECTS) {
    insertProject.run(randomUUID(), project.slug, project.name, project.description, firstAdminId);
  }

  // 3. Create project access (all admins = admin on all projects)
  const insertAccess = db.prepare(
    "INSERT OR IGNORE INTO project_access (id, user_id, project_slug, role) VALUES (?, ?, ?, 'admin')"
  );

  for (const user of ADMIN_USERS) {
    for (const project of PROJECTS) {
      insertAccess.run(randomUUID(), userIds[user.email], project.slug);
    }
  }

  // 4. Create API keys (one per admin, idempotent — check if key exists)
  for (const user of ADMIN_USERS) {
    const userId = userIds[user.email];
    const existingKey = db.prepare('SELECT id FROM api_keys WHERE user_id = ?').get(userId);
    if (!existingKey) {
      const apiKey = `ms_${randomUUID().replace(/-/g, '')}`;
      const keyHash = createHash('sha256').update(apiKey).digest('hex');
      db.prepare(
        'INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)'
      ).run(randomUUID(), userId, keyHash, `${user.name} - seed key`);

      // Log key to stdout (only on first creation)
      console.log(`API key for ${user.name}: ${apiKey}`);
    }
  }

  console.log('Seed complete.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
```

### Usage

```bash
# Run seed script
node api/db/seed.js

# Output (first run only):
# API key for Thomas Pichler: ms_abc123...
# API key for Robin Pichler: ms_def456...
# API key for Maria Pichler: ms_ghi789...
# Seed complete.
```

### Idempotency

- `INSERT OR IGNORE` for users, projects, project_access — safe to re-run
- API keys only created if user has no existing key
- `is_system_admin` always set to 1 even if user already exists

## Study

### Test Cases (10 total)

1. Creates all 3 admin users with is_system_admin=1
2. Creates both projects
3. Creates project_access entries (3 users × 2 projects = 6 entries)
4. Creates API keys for each user
5. Re-running seed is idempotent (no duplicates)
6. Existing users get is_system_admin=1 updated
7. API keys not duplicated on re-run
8. seed() function is importable (not just CLI)
9. All users have valid password_hash (non-empty)
10. Project created_by references first admin user

## Act

### Deployment

- 1 file: seed.ts (NEW)
- Run manually after fresh install: `node api/db/seed.js`
- API keys printed to stdout — operator must save them
- Not automatically run — explicit choice to seed
