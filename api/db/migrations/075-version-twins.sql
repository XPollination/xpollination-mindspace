-- Version twins: deployment as twin transition
-- Each version carries migrations, feature flags, apply/rollback steps
CREATE TABLE IF NOT EXISTS version_twins (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  parent_version TEXT,
  viz_path TEXT,
  migrations_json TEXT,
  feature_flags_json TEXT,
  config_defaults_json TEXT,
  apply_steps_json TEXT NOT NULL,
  rollback_steps_json TEXT,
  requires_rebuild INTEGER DEFAULT 0,
  changelog TEXT,
  commits_json TEXT,
  decision_refs_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'rolled_back')),
  applied_at TEXT,
  applied_by TEXT,
  cid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_version_twins_version ON version_twins(version);
CREATE INDEX IF NOT EXISTS idx_version_twins_status ON version_twins(status);
