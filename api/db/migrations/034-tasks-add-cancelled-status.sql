-- Add 'cancelled' to tasks status CHECK constraint
-- Required for workflow engine any->cancelled transitions (F1 fix)
-- SQLite requires table recreation to alter CHECK constraints

CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requirement_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete', 'cancelled')),
  current_role TEXT CHECK(current_role IN ('pdsa', 'dev', 'qa', 'liaison')),
  claimed_by TEXT REFERENCES agents(id),
  claimed_at TEXT,
  feature_flag_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dna_json TEXT,
  slug TEXT
);

INSERT INTO tasks_new SELECT * FROM tasks;

DROP TABLE tasks;

ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_slug);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(current_role);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);
