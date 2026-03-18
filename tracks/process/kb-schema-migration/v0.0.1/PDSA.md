# PDSA: Schema Migration — Knowledge Browser Columns

**Task:** `kb-schema-migration`
**Version:** v0.0.1
**Status:** Design

## Plan

Add `short_id`, `content_md`, and `content_version` columns to missions, capabilities, and requirements tables. Create `node_content_history` table. Generate short_ids for existing nodes.

### Two Deliverables

1. **Migration 052-knowledge-browser-schema.sql**: Schema changes (ALTER TABLE + CREATE TABLE)
2. **scripts/generate-short-ids.js**: One-time script to populate short_ids for existing nodes

### Migration 052 (SQL)

```sql
-- Knowledge Browser schema additions
-- Adds short_id (URL-friendly), content_md, content_version to hierarchy tables
-- Creates node_content_history for version tracking

ALTER TABLE missions ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE missions ADD COLUMN content_md TEXT;
ALTER TABLE missions ADD COLUMN content_version INTEGER DEFAULT 0;

ALTER TABLE capabilities ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE capabilities ADD COLUMN content_md TEXT;
ALTER TABLE capabilities ADD COLUMN content_version INTEGER DEFAULT 0;

ALTER TABLE requirements ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE requirements ADD COLUMN content_md TEXT;
ALTER TABLE requirements ADD COLUMN content_version INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS node_content_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK(node_type IN ('mission', 'capability', 'requirement')),
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_history_node ON node_content_history(node_id, node_type);
```

### Short ID Generation Script

```javascript
// scripts/generate-short-ids.js
// Generates 8-char Base62 IDs (a-z A-Z 0-9) for all existing hierarchy nodes
// Uses crypto.randomBytes, collision-checked before insert
// Idempotent: skips nodes that already have short_id

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Generate: crypto.randomBytes(6) → 48 bits → encode to 8 Base62 chars
// Collision check: SELECT 1 FROM {table} WHERE short_id = ? before insert
// Tables: missions, capabilities, requirements
```

### Node Counts (existing)
- Missions: ~6 (3 PLATFORM-001 + legacy)
- Capabilities: ~14 (9 PLATFORM-001 + 5 legacy)
- Requirements: ~15 (from migration 049)

## Do

DEV creates:
1. `api/db/migrations/052-knowledge-browser-schema.sql`
2. `scripts/generate-short-ids.js`

## Study

Verify:
- All 3 tables have short_id, content_md, content_version columns
- node_content_history table exists with correct schema
- All existing nodes have 8-char Base62 short_ids
- No duplicate short_ids (UNIQUE constraint)
- Script is idempotent (re-run skips nodes with existing short_id)

## Act

### Design Decisions
1. **Base62 8-char**: 62^8 = 218 trillion combinations. No collision risk at current scale.
2. **Separate script**: Short ID generation is a one-time operation, not a migration. Keeps migration pure SQL.
3. **content_version INTEGER**: Simple incrementing version, not semantic versioning.
4. **node_content_history**: Append-only audit trail. Never delete history rows.
5. **Migration number 052**: Next available after existing migrations.
