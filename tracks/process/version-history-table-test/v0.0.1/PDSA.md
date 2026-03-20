# PDSA: TDD Tests — capability_version_history Table

**Task:** `version-history-table-test`
**Version:** v0.0.1
**Status:** Design

## Plan

### Context

Migration 057 created the `capability_version_history` table:

```sql
CREATE TABLE IF NOT EXISTS capability_version_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  version INTEGER NOT NULL,
  changelog TEXT,
  contributing_tasks TEXT,
  requirements_satisfied TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  pdsa_ref TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cap_version_history_cap_ver
  ON capability_version_history(capability_id, version);
```

The design tests (`version-history-table-design.test.ts`) verify schema existence. This test spec covers **behavioral tests**: inserting version entries, querying by capability, enforcing uniqueness, and linking tasks/requirements via JSON arrays.

### Test File

`api/__tests__/version-history-table.test.ts`

### Test Cases

#### 1. Insert a version entry

```typescript
it('inserts a version entry for a capability', () => {
  db.prepare(`
    INSERT INTO capability_version_history
      (capability_id, version, changelog, contributing_tasks, requirements_satisfied, changed_by, pdsa_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('cap-org-brain', 1, 'Initial version', '["task-1"]', '["REQ-CP-001"]', 'pdsa', 'https://example.com/pdsa');

  const row = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ? AND version = ?')
    .get('cap-org-brain', 1);
  expect(row).toBeDefined();
  expect(row.changelog).toBe('Initial version');
  expect(row.changed_by).toBe('pdsa');
});
```

#### 2. Query versions for a capability (sorted)

```typescript
it('returns versions ordered by version number', () => {
  // Insert v1 and v2
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 1, 'v1 changes', 'pdsa');
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 2, 'v2 changes', 'dev');

  const rows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC')
    .all('cap-org-brain');
  expect(rows).toHaveLength(2);
  expect(rows[0].version).toBe(2);
  expect(rows[1].version).toBe(1);
});
```

#### 3. Unique constraint on (capability_id, version)

```typescript
it('rejects duplicate (capability_id, version) pairs', () => {
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 1, 'first', 'pdsa');

  expect(() => {
    db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
      .run('cap-org-brain', 1, 'duplicate', 'dev');
  }).toThrow();
});
```

#### 4. contributing_tasks stored as JSON array

```typescript
it('stores and retrieves contributing_tasks as JSON', () => {
  const tasks = JSON.stringify(['task-alpha', 'task-beta', 'task-gamma']);
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, contributing_tasks, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-integration', 1, tasks, 'pdsa');

  const row = db.prepare('SELECT contributing_tasks FROM capability_version_history WHERE capability_id = ? AND version = ?')
    .get('cap-integration', 1);
  const parsed = JSON.parse(row.contributing_tasks);
  expect(parsed).toEqual(['task-alpha', 'task-beta', 'task-gamma']);
  expect(parsed).toHaveLength(3);
});
```

#### 5. requirements_satisfied stored as JSON array

```typescript
it('stores and retrieves requirements_satisfied as JSON', () => {
  const reqs = JSON.stringify(['REQ-CP-001', 'REQ-CP-002']);
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, requirements_satisfied, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-release', 1, reqs, 'pdsa');

  const row = db.prepare('SELECT requirements_satisfied FROM capability_version_history WHERE capability_id = ? AND version = ?')
    .get('cap-release', 1);
  const parsed = JSON.parse(row.requirements_satisfied);
  expect(parsed).toContain('REQ-CP-001');
  expect(parsed).toContain('REQ-CP-002');
});
```

#### 6. changed_at defaults to current timestamp

```typescript
it('auto-populates changed_at timestamp', () => {
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changed_by) VALUES (?, ?, ?)`)
    .run('cap-marketplace', 1, 'system');

  const row = db.prepare('SELECT changed_at FROM capability_version_history WHERE capability_id = ? AND version = ?')
    .get('cap-marketplace', 1);
  expect(row.changed_at).toBeDefined();
  expect(row.changed_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date prefix
});
```

#### 7. Multiple capabilities have independent version histories

```typescript
it('isolates version histories per capability', () => {
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changed_by) VALUES (?, ?, ?)`)
    .run('cap-org-brain', 1, 'pdsa');
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changed_by) VALUES (?, ?, ?)`)
    .run('cap-integration', 1, 'pdsa');

  const brainRows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ?').all('cap-org-brain');
  const intRows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ?').all('cap-integration');
  expect(brainRows).toHaveLength(1);
  expect(intRows).toHaveLength(1);
});
```

### Fixtures

```typescript
// Capability fixture: ensure cap-org-brain exists (seeded by migration 048)
// Capability fixture: ensure cap-integration exists (seeded by migration 048)
// No additional fixtures needed — migrations seed the capabilities table
```

### Setup Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

beforeEach(() => {
  // Clean version history between tests
  db.prepare('DELETE FROM capability_version_history').run();
});
```

## Do

DEV:
1. Create `api/__tests__/version-history-table.test.ts` with 7 tests above
2. Tests should all fail (TDD — no implementation changes needed, table already exists from migration 057)
3. Expected: tests should PASS since table + migration already deployed

## Study

Verify:
- All 7 tests pass against current schema (migration 057 is deployed)
- Unique constraint test correctly throws on duplicates
- JSON round-trip works for contributing_tasks and requirements_satisfied
- changed_at auto-populates without explicit value

## Act

### Design Decisions
1. **Direct SQL tests, not API tests**: This table has no API endpoint yet. Tests validate schema behavior directly.
2. **JSON arrays for tasks/requirements**: SQLite stores TEXT; application layer parses. Simpler than junction tables for version metadata.
3. **beforeEach cleanup**: Each test starts with empty version history. Prevents test coupling.
4. **Real capability IDs**: Uses cap-org-brain, cap-integration etc. from migration 048. No fake IDs.
5. **7 focused tests**: One concern per test. Insert, query, uniqueness, JSON round-trip, defaults, isolation.
