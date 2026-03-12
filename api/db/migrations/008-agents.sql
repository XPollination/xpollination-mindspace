CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  current_role TEXT,
  capabilities TEXT,
  project_slug TEXT REFERENCES projects(slug),
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'disconnected')),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_slug);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id);
