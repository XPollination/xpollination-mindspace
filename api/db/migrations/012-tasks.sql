CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requirement_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete')),
  current_role TEXT CHECK(current_role IN ('pdsa', 'dev', 'qa', 'liaison')),
  claimed_by TEXT REFERENCES agents(id),
  claimed_at TEXT,
  feature_flag_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_slug);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(current_role);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
