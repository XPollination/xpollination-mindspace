-- Agent lease bonds: session-level leases for agent lifecycle
CREATE TABLE IF NOT EXISTS agent_bonds (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('active', 'expired')) DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  renewed_at TEXT,
  expires_at TEXT NOT NULL,
  expired_at TEXT,
  renewal_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_bonds_agent ON agent_bonds(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_bonds_status ON agent_bonds(status);
