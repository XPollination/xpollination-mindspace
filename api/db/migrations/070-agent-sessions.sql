-- Agent session store: persistent sessions that survive reconnects and restarts
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT DEFAULT '["read","write","transition"]',
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','idle','disconnected','expired')),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  disconnected_at TEXT,
  expires_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_token ON agent_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_role ON agent_sessions(role, project_slug, status);
