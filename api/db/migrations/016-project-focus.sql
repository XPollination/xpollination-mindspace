CREATE TABLE IF NOT EXISTS project_focus (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL UNIQUE REFERENCES projects(slug),
  scope TEXT NOT NULL,
  task_ids TEXT,
  set_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
