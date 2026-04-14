-- OAuth Device Flow (RFC 8628) for CLI agent authentication.
-- claude-session requests a device code, user approves in browser, JWT issued.
-- No static API keys needed for agent auth.
-- See: api/routes/SECURITY.md, docs/missions/mission-agent-oauth-sessions.md
CREATE TABLE IF NOT EXISTS device_codes (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  user_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'expired', 'used')),
  client_name TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
