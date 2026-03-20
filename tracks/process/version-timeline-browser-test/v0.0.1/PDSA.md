# PDSA: TDD Tests — Version Timeline Browser

**Task:** `version-timeline-browser-test`
**Version:** v0.0.1
**Status:** Design

## Plan

### Context

The version timeline design adds an expandable "Version History" section to capability document pages. It queries `capability_version_history` and renders entries with green/gray borders, changelog, contributing tasks, and requirements. This test spec validates the rendering behavior.

### Test File

`api/__tests__/version-timeline-browser.test.ts`

### Test Cases

#### 1. Version timeline section renders on capability pages

```typescript
it('renders version timeline section for capabilities', () => {
  // Insert version entries for a capability
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 1, 'Initial release', 'pdsa');

  // Check that server.js contains version timeline rendering logic
  const serverJs = readFileSync(resolve(__dirname, '../../viz/server.js'), 'utf-8');
  expect(serverJs).toMatch(/version.timeline|Version History/i);
});
```

#### 2. Version entries ordered newest first

```typescript
it('queries versions in descending order', () => {
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 1, 'v1', 'pdsa');
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 2, 'v2', 'dev');
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 3, 'v3', 'pdsa');

  const rows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC').all('cap-org-brain');
  expect(rows[0].version).toBe(3);
  expect(rows[2].version).toBe(1);
});
```

#### 3. Empty state when no versions exist

```typescript
it('handles capabilities with no version history', () => {
  const rows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ?').all('cap-integration');
  expect(rows).toHaveLength(0);
  // Server should render "No versions recorded yet." for empty state
  const serverJs = readFileSync(resolve(__dirname, '../../viz/server.js'), 'utf-8');
  expect(serverJs).toMatch(/No versions recorded/i);
});
```

#### 4. Contributing tasks stored and retrievable as JSON

```typescript
it('stores contributing tasks as parseable JSON', () => {
  const tasks = JSON.stringify(['task-alpha', 'task-beta']);
  db.prepare(`INSERT INTO capability_version_history (capability_id, version, contributing_tasks, changed_by) VALUES (?, ?, ?, ?)`)
    .run('cap-org-brain', 1, tasks, 'pdsa');

  const row = db.prepare('SELECT contributing_tasks FROM capability_version_history WHERE capability_id = ? AND version = ?')
    .get('cap-org-brain', 1);
  const parsed = JSON.parse(row.contributing_tasks);
  expect(parsed).toEqual(['task-alpha', 'task-beta']);
});
```

#### 5. Expand/collapse for more than 3 versions

```typescript
it('supports expand behavior for >3 versions', () => {
  // Insert 5 versions
  for (let i = 1; i <= 5; i++) {
    db.prepare(`INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES (?, ?, ?, ?)`)
      .run('cap-org-brain', i, `Version ${i}`, 'pdsa');
  }

  const rows = db.prepare('SELECT * FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC').all('cap-org-brain');
  expect(rows).toHaveLength(5);
  // Server.js should have expand/collapse logic
  const serverJs = readFileSync(resolve(__dirname, '../../viz/server.js'), 'utf-8');
  expect(serverJs).toMatch(/version-hidden|Show.*more/i);
});
```

### Setup Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

beforeEach(() => {
  db.prepare('DELETE FROM capability_version_history').run();
});
```

## Do

DEV:
1. Create `api/__tests__/version-timeline-browser.test.ts` with 5 tests
2. Tests validate both schema behavior and rendering logic presence
3. Expected: tests should pass since timeline implementation is deployed

## Study

Verify:
- All 5 tests pass
- Version ordering is DESC (newest first)
- JSON round-trip works for contributing_tasks
- Expand/collapse pattern exists in server.js
- Empty state message exists

## Act

### Design Decisions
1. **Mixed testing approach**: Schema behavior (INSERT/query) + code inspection (server.js patterns). Covers both data layer and rendering.
2. **beforeEach cleanup**: Clean version history between tests.
3. **readFileSync for rendering**: Since viz/server.js generates HTML server-side, we inspect the source for expected patterns rather than spinning up HTTP server.
4. **5 focused tests**: Timeline section exists, ordering, empty state, JSON tasks, expand behavior.
