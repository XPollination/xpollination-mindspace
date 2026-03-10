CREATE TABLE IF NOT EXISTS project_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'contributor', 'viewer')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE(user_id, project_slug)
);

CREATE INDEX IF NOT EXISTS idx_project_access_user ON project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_slug ON project_access(project_slug);
