# PDSA: Requirement Versioning (History Table)

**Task:** ms-a4-2-req-versioning
**Status:** Design
**Version:** v0.0.1

## Plan

Add automatic versioning to requirements. Every update to a requirement creates a version record capturing the full state before the change. A history endpoint lets users view all versions.

### Dependencies

- **ms-a4-1-requirements-crud** (complete): Requirements table + CRUD
- **t1-3-repos-bootstrap** (complete): Project/repo setup

### Investigation

**Current requirements table:** id, project_slug, req_id_human, title, description, status, priority, current_version, created_at, created_by, updated_at

**Design decisions:**
- Snapshot-based versioning: store complete requirement state per version (not diffs)
- Auto-create version on PUT (update) — caller doesn't need to manage versions
- `current_version` on requirements table tracks latest version number
- Version records are immutable (no UPDATE/DELETE on versions)

## Do

### File Changes

#### 1. `api/db/migrations/015-requirement-versions.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS requirement_versions (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id),
  change_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(requirement_id, version)
);

CREATE INDEX IF NOT EXISTS idx_req_versions_req ON requirement_versions(requirement_id);
```

#### 2. `api/routes/requirements.ts` (UPDATE)

Modify the PUT handler to auto-create a version before applying changes:

```typescript
// In PUT handler, before the UPDATE statement:
const versionId = randomUUID();
const newVersion = (existing.current_version ? parseInt(existing.current_version, 10) : 0) + 1;

// Snapshot current state as version record
db.prepare(
  `INSERT INTO requirement_versions (id, requirement_id, version, title, description, status, priority, changed_by, change_summary)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(versionId, existing.id, newVersion, existing.title, existing.description, existing.status, existing.priority, user.id, req.body.change_summary || null);

// Update current_version on the requirement
// (add current_version to the UPDATE statement)
```

Add history endpoint:

```typescript
// GET /:reqId/history — list all versions
requirementsRouter.get('/:reqId/history', requireProjectAccess('viewer'), (req, res) => {
  const { slug, reqId } = req.params;
  const db = getDb();

  // Dual lookup
  let requirement = db.prepare('SELECT * FROM requirements WHERE id = ? AND project_slug = ?').get(reqId, slug) as any;
  if (!requirement) {
    requirement = db.prepare('SELECT * FROM requirements WHERE req_id_human = ? AND project_slug = ?').get(reqId, slug) as any;
  }
  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found' });
    return;
  }

  const versions = db.prepare(
    'SELECT * FROM requirement_versions WHERE requirement_id = ? ORDER BY version DESC'
  ).all(requirement.id);

  res.status(200).json({ requirement_id: requirement.id, versions });
});
```

## Study

### Test Cases (12 total)

**Migration (1):**
1. requirement_versions table exists with UNIQUE(requirement_id, version)

**Auto-versioning on update (4):**
2. PUT creates a version record with pre-update snapshot
3. current_version increments on each update
4. Version record contains correct title, description, status, priority
5. change_summary is stored when provided

**History endpoint (3):**
6. GET /history returns all versions ordered by version DESC
7. GET /history supports dual lookup (UUID and req_id_human)
8. Returns 404 for non-existent requirement

**Version immutability (2):**
9. Multiple updates create sequential version records
10. Version records capture the state BEFORE the change (snapshot of previous)

**Edge cases (2):**
11. First update on a requirement with no versions creates version 1
12. Deleting a requirement cascades to version records

## Act

### Deployment

- Migration 015 creates requirement_versions table
- 2 files: migration (NEW), requirements.ts (UPDATE)
- No breaking changes — PUT behavior is enhanced (existing calls still work)
