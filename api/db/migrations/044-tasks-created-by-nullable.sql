-- Make created_by nullable with default for system/CLI-created tasks
PRAGMA defer_foreign_keys = ON;

CREATE TABLE tasks_v3 (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requirement_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete', 'cancelled')),
  current_role TEXT CHECK(current_role IN ('pdsa', 'dev', 'qa', 'liaison')),
  claimed_by TEXT REFERENCES users(id),
  claimed_at TEXT,
  feature_flag_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT DEFAULT 'system',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dna_json TEXT,
  slug TEXT,
  dna TEXT
);

INSERT INTO tasks_v3 SELECT id, project_slug, requirement_id, title, description, status, current_role, claimed_by, claimed_at, feature_flag_name, created_at, created_by, updated_at, dna_json, slug, dna FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_v3 RENAME TO tasks;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_slug);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(current_role);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);
