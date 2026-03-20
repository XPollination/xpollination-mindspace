-- Node relationships table: SpiceDB-compatible tuple storage
-- Format: source_type:source_id#relation@target_type:target_id
-- Example: mission:mission-fair-attribution#COMPOSES@capability:cap-auth

CREATE TABLE IF NOT EXISTS node_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, relation, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON node_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON node_relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_rel_relation ON node_relationships(relation);
