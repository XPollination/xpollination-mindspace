# PDSA: TDD Tests — node_relationships Table

**Task:** `relationship-table-test`
**Version:** v0.0.1
**Status:** Design

## Plan

### Context

Migration 058 creates `node_relationships` with source/target type+id, relation, metadata JSON, UNIQUE constraint, and 3 indexes. This test spec validates CRUD operations, type validation, and cross-reference queries.

### Test File

`api/__tests__/relationship-table.test.ts`

### Test Cases

#### 1. Insert a COMPOSES relationship

```typescript
it('creates a COMPOSES relationship', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-org-brain', 'pdsa');

  const row = db.prepare('SELECT * FROM node_relationships WHERE source_id = ? AND relation = ?')
    .get('mission-fair-attribution', 'COMPOSES');
  expect(row).toBeDefined();
  expect(row.target_id).toBe('cap-org-brain');
});
```

#### 2. Unique constraint prevents duplicates

```typescript
it('rejects duplicate relationship tuples', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-org-brain', 'pdsa');

  expect(() => {
    db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-org-brain', 'pdsa');
  }).toThrow();
});
```

#### 3. Query outgoing relationships

```typescript
it('queries outgoing relationships for a node', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-org-brain', 'pdsa');
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-integration', 'pdsa');

  const rows = db.prepare('SELECT * FROM node_relationships WHERE source_type = ? AND source_id = ?')
    .all('mission', 'mission-fair-attribution');
  expect(rows).toHaveLength(2);
});
```

#### 4. Query incoming relationships

```typescript
it('queries incoming relationships for a target', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('capability', 'cap-org-brain', 'IMPLEMENTS', 'requirement', 'req-001', 'pdsa');
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('capability', 'cap-integration', 'IMPLEMENTS', 'requirement', 'req-001', 'pdsa');

  const rows = db.prepare('SELECT * FROM node_relationships WHERE target_type = ? AND target_id = ?')
    .all('requirement', 'req-001');
  expect(rows).toHaveLength(2);
});
```

#### 5. Metadata stored as JSON

```typescript
it('stores and retrieves metadata as JSON', () => {
  const meta = JSON.stringify({ weight: 0.8, notes: 'primary contributor' });
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('capability', 'cap-org-brain', 'CONTRIBUTES_TO', 'mission', 'mission-fair-attribution', meta, 'pdsa');

  const row = db.prepare('SELECT metadata FROM node_relationships WHERE source_id = ? AND relation = ?')
    .get('cap-org-brain', 'CONTRIBUTES_TO');
  const parsed = JSON.parse(row.metadata);
  expect(parsed.weight).toBe(0.8);
  expect(parsed.notes).toBe('primary contributor');
});
```

#### 6. Different relation types between same nodes

```typescript
it('allows different relation types between same node pair', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('capability', 'cap-org-brain', 'IMPLEMENTS', 'requirement', 'req-001', 'pdsa');
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('capability', 'cap-org-brain', 'DRIVEN_BY', 'requirement', 'req-001', 'pdsa');

  const rows = db.prepare('SELECT * FROM node_relationships WHERE source_id = ? AND target_id = ?')
    .all('cap-org-brain', 'req-001');
  expect(rows).toHaveLength(2);
  expect(rows.map(r => r.relation).sort()).toEqual(['DRIVEN_BY', 'IMPLEMENTS']);
});
```

#### 7. Filter by relation type

```typescript
it('filters relationships by relation type', () => {
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-org-brain', 'pdsa');
  db.prepare(`INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('task', 'task-1', 'DEPENDS_ON', 'task', 'task-2', 'pdsa');

  const composes = db.prepare('SELECT * FROM node_relationships WHERE relation = ?').all('COMPOSES');
  expect(composes).toHaveLength(1);
  expect(composes[0].source_id).toBe('mission-fair-attribution');
});
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
  db.prepare('DELETE FROM node_relationships').run();
});
```

## Do

DEV:
1. Create `api/__tests__/relationship-table.test.ts` with 7 tests
2. Tests should pass against migration 058 schema

## Study

Verify:
- All 7 tests pass
- UNIQUE constraint enforced
- Outgoing and incoming queries work
- JSON metadata round-trip
- Multiple relation types between same nodes allowed

## Act

### Design Decisions
1. **7 focused tests**: CRUD, uniqueness, outgoing, incoming, metadata, multi-relation, filter.
2. **beforeEach cleanup**: Prevents test coupling.
3. **Real-ish IDs**: Uses mission/capability IDs that match seeded data patterns.
4. **No CLI tests**: Tests validate schema behavior directly. CLI validation tested separately.
