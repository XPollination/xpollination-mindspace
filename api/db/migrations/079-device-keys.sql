-- Ed25519 persistent device keys for agent authentication.
-- Replaces 24h JWT tokens. One key per machine, unlimited agent connections.
-- See: docs/missions/mission-agent-oauth-sessions.md v2.0

CREATE TABLE IF NOT EXISTS device_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  public_key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  last_active TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_keys_user ON device_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_device_keys_hash ON device_keys(public_key_hash);

CREATE TABLE IF NOT EXISTS agent_connections (
  id TEXT PRIMARY KEY,
  device_key_id TEXT NOT NULL REFERENCES device_keys(id),
  agent_id TEXT REFERENCES agents(id),
  agent_name TEXT NOT NULL,
  session_name TEXT,
  role TEXT,
  project_slug TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  last_heartbeat TEXT DEFAULT (datetime('now')),
  disconnected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_conn_key ON agent_connections(device_key_id);
CREATE INDEX IF NOT EXISTS idx_agent_conn_agent ON agent_connections(agent_id);

-- Link agents to device keys for SSE revocation targeting
ALTER TABLE agents ADD COLUMN device_key_id TEXT REFERENCES device_keys(id);
