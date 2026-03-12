CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  task_id TEXT REFERENCES tasks(id),
  flag_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'off' CHECK(state IN ('off', 'on')),
  toggled_by TEXT REFERENCES users(id),
  toggled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(project_slug, flag_name)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_project ON feature_flags(project_slug);
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_state ON feature_flags(state);
