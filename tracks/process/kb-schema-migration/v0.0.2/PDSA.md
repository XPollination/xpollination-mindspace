# PDSA: Schema Migration — Knowledge Browser Columns

**Task:** `kb-schema-migration`
**Version:** v0.0.2 (rework — full SQL, design rationale, algorithm spec)
**Status:** Design

## Plan

### Problem
The knowledge browser needs URL-addressable hierarchy nodes with versioned content. Current tables (missions, capabilities, requirements) have UUIDs as primary keys — too long for URLs and not human-friendly.

### Solution
Add three columns to each hierarchy table and create a history table:
- `short_id` (TEXT UNIQUE) — 8-char Base62 for URL-friendly identifiers (e.g., `/m/a7Bk3xQ9/fair-attribution`)
- `content_md` (TEXT) — markdown content for the knowledge browser page
- `content_version` (INTEGER) — monotonically incrementing version counter
- `node_content_history` — append-only audit trail of content changes

### Design Decisions

1. **Base62 8-char short_id**: `[a-zA-Z0-9]` gives 62^8 = 218 trillion combinations. At current scale (~40 nodes), collision probability is effectively zero. 8 chars is short enough for URLs but long enough to avoid collisions even at 1M nodes.

2. **Separate script for short_id generation**: SQLite's `ALTER TABLE ADD COLUMN` cannot include a DEFAULT with a function call. Short IDs need crypto.randomBytes which requires JS, not pure SQL. Migration adds the column, script populates it.

3. **content_version as INTEGER (not semver)**: Simple incrementing counter. Content changes are frequent and granular — semantic versioning adds complexity without value here.

4. **node_content_history append-only**: Never delete history rows. Enables diff viewing and audit trail. `changed_by` tracks which agent or user modified content.

5. **Migration number 052**: Follows existing migration numbering. Checked: 051 is the highest existing migration.

### Migration SQL: `api/db/migrations/052-knowledge-browser-schema.sql`

```sql
-- Knowledge Browser schema — short_id, content_md, content_version for hierarchy tables
-- Plus node_content_history for version tracking

-- Missions: add knowledge browser columns
ALTER TABLE missions ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE missions ADD COLUMN content_md TEXT;
ALTER TABLE missions ADD COLUMN content_version INTEGER DEFAULT 0;

-- Capabilities: add knowledge browser columns
ALTER TABLE capabilities ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE capabilities ADD COLUMN content_md TEXT;
ALTER TABLE capabilities ADD COLUMN content_version INTEGER DEFAULT 0;

-- Requirements: add knowledge browser columns
ALTER TABLE requirements ADD COLUMN short_id TEXT UNIQUE;
ALTER TABLE requirements ADD COLUMN content_md TEXT;
ALTER TABLE requirements ADD COLUMN content_version INTEGER DEFAULT 0;

-- Content history table (append-only audit trail)
CREATE TABLE IF NOT EXISTS node_content_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK(node_type IN ('mission', 'capability', 'requirement')),
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient history lookups by node
CREATE INDEX IF NOT EXISTS idx_content_history_node
  ON node_content_history(node_id, node_type);
```

### Short ID Generation Script: `scripts/generate-short-ids.js`

Algorithm:
1. Open API database (better-sqlite3, read-write)
2. For each table (missions, capabilities, requirements):
   a. SELECT id FROM {table} WHERE short_id IS NULL
   b. For each row: generate 8-char Base62 from crypto.randomBytes(6)
   c. Collision check: SELECT 1 FROM {table} WHERE short_id = ?
   d. If collision (extremely unlikely): regenerate
   e. UPDATE {table} SET short_id = ? WHERE id = ?
3. Report: "Generated N short_ids for missions, N for capabilities, N for requirements"

Base62 encoding:
```javascript
const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function generateBase62(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => CHARSET[b % 62]).join('');
}
```

Idempotent: `WHERE short_id IS NULL` ensures re-running skips nodes that already have IDs.

## Do

DEV creates:
1. `api/db/migrations/052-knowledge-browser-schema.sql` — exact SQL above
2. `scripts/generate-short-ids.js` — implements algorithm above

## Study

Verify:
- All 3 tables have short_id, content_md, content_version columns
- node_content_history table exists with correct schema and index
- All existing nodes (~40) have 8-char Base62 short_ids
- No duplicate short_ids (UNIQUE constraint enforced)
- Script re-run is safe (idempotent via NULL check)
- `SELECT length(short_id) FROM missions WHERE short_id IS NOT NULL` returns 8 for all rows

## Act

Rework addressed:
- Full SQL embedded in PDSA (not just restated from DNA)
- Design decisions documented with rationale
- Short ID generation algorithm specified with code
- Idempotency mechanism explained
