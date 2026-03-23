# PDSA: Design — node_relationships Table (SpiceDB-Compatible)

**Task:** `relationship-table-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem

The current hierarchy uses hardcoded FKs: `capabilities.mission_id`, `requirements.capability_id`, `task_dependencies.blocked_by_task_id`. This is rigid — a capability can only belong to one mission, and cross-cutting relationships (e.g., a requirement satisfied by capabilities across missions) can't be expressed.

### Solution

A generic `node_relationships` table that maps to SpiceDB tuple format: `(source_type:source_id, relation, target_type:target_id)`. SQLite first, with SpiceDB migration path later.

### Schema

```sql
-- Migration 058-node-relationships.sql

CREATE TABLE IF NOT EXISTS node_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,     -- 'mission', 'capability', 'requirement', 'task', 'user'
  source_id TEXT NOT NULL,       -- ID of the source node
  relation TEXT NOT NULL,        -- Relationship type (see enum below)
  target_type TEXT NOT NULL,     -- 'mission', 'capability', 'requirement', 'task', 'user'
  target_id TEXT NOT NULL,       -- ID of the target node
  metadata TEXT,                 -- JSON: permissions, weight, notes
  created_by TEXT NOT NULL,      -- Actor who created this relationship
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, relation, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_nr_source ON node_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_nr_target ON node_relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_nr_relation ON node_relationships(relation);
```

### Relationship Types

| Relation | Source → Target | Meaning |
|----------|----------------|---------|
| `COMPOSES` | mission → capability | Mission contains this capability |
| `IMPLEMENTS` | capability → requirement | Capability implements this requirement |
| `DEPENDS_ON` | task → task | Task blocked by another task |
| `ASSIGNED_TO` | task → user | Task assigned to user |
| `DRIVEN_BY` | capability → requirement | Capability driven by this requirement |
| `SATISFIED_BY` | requirement → task | Requirement satisfied by completed task |
| `CONTRIBUTES_TO` | capability → mission | Capability contributes to (secondary) mission |
| `RELATES_TO` | any → any | Generic cross-reference |

### SpiceDB Compatibility

SpiceDB tuples: `object_type:object_id#relation@subject_type:subject_id`

Our mapping:
```
node_relationships row → SpiceDB tuple:
  source_type:source_id#relation@target_type:target_id

Example:
  mission:mission-fair-attribution#COMPOSES@capability:cap-org-brain
  → "mission-fair-attribution COMPOSES cap-org-brain"
```

The `metadata` JSON field has no SpiceDB equivalent — it stores local context (permissions, weight) that would be handled by SpiceDB's permission model after migration.

### CLI Commands

#### `relationship-create`

```bash
node interface-cli.js relationship-create <source_type> <source_id> <relation> <target_type> <target_id> [metadata_json] <actor>
```

```javascript
function cmdRelationshipCreate(sourceType, sourceId, relation, targetType, targetId, metadataJson, actor) {
  const db = getDb();
  const validRelations = ['COMPOSES', 'IMPLEMENTS', 'DEPENDS_ON', 'ASSIGNED_TO', 'DRIVEN_BY', 'SATISFIED_BY', 'CONTRIBUTES_TO', 'RELATES_TO'];
  if (!validRelations.includes(relation)) {
    console.error(`Invalid relation: ${relation}. Valid: ${validRelations.join(', ')}`);
    process.exit(1);
  }
  db.prepare(`
    INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, metadata, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sourceType, sourceId, relation, targetType, targetId, metadataJson || null, actor);

  const created = db.prepare(
    "SELECT * FROM node_relationships WHERE source_type = ? AND source_id = ? AND relation = ? AND target_type = ? AND target_id = ?"
  ).get(sourceType, sourceId, relation, targetType, targetId);

  console.log(JSON.stringify(created, null, 2));
}
```

#### `relationship-list`

```bash
node interface-cli.js relationship-list <type> <id> [--direction=outgoing|incoming|both]
```

```javascript
function cmdRelationshipList(nodeType, nodeId, direction = 'both') {
  const db = getDb();
  let rows = [];
  if (direction === 'outgoing' || direction === 'both') {
    rows = rows.concat(db.prepare(
      "SELECT *, 'outgoing' as direction FROM node_relationships WHERE source_type = ? AND source_id = ?"
    ).all(nodeType, nodeId));
  }
  if (direction === 'incoming' || direction === 'both') {
    rows = rows.concat(db.prepare(
      "SELECT *, 'incoming' as direction FROM node_relationships WHERE target_type = ? AND target_id = ?"
    ).all(nodeType, nodeId));
  }
  console.log(JSON.stringify({ node: `${nodeType}:${nodeId}`, relationships: rows, count: rows.length }, null, 2));
}
```

### Backward Compatibility

- Existing FK columns (`mission_id`, `capability_id`) remain untouched
- `node_relationships` is additive — it expresses NEW relationships
- When SpiceDB is deployed, FK data migrates to SpiceDB tuples via a migration script
- No existing queries break

### Decision Points Resolved

1. **SQLite first, then SpiceDB**: SpiceDB adds complexity (Docker container, gRPC). SQLite table gives us the data model now. Migration to SpiceDB is a separate task (`spicedb-setup-*`).
2. **No FK migration in this task**: Existing FKs stay. This table is for NEW cross-cutting relationships. Migration is out of scope per DNA.

## Do

DEV:
1. Create migration `058-node-relationships.sql`
2. Add `cmdRelationshipCreate()` and `cmdRelationshipList()` to interface-cli.js
3. Add case routing in main switch

## Study

Verify:
- `node interface-cli.js relationship-create mission mission-fair-attribution COMPOSES capability cap-org-brain pdsa` succeeds
- `node interface-cli.js relationship-list mission mission-fair-attribution` returns the relationship
- Duplicate relationship rejected (UNIQUE constraint)
- Invalid relation type rejected

## Act

### Design Decisions
1. **Generic table**: `source_type/source_id` + `target_type/target_id` instead of typed FKs. Flexible for any node pair.
2. **Relation enum validated in CLI**: Not enforced at SQL level (TEXT column), but CLI validates against known types.
3. **UNIQUE constraint**: Prevents duplicate relationships. Same pair + same relation = one row.
4. **3 indexes**: Source lookup, target lookup, relation type filter. Covers common query patterns.
5. **metadata as JSON**: Extensible field for permissions, weight, notes. No schema migration needed for new metadata fields.
6. **SpiceDB tuple format**: Table structure maps directly to SpiceDB's `object#relation@subject` model.
