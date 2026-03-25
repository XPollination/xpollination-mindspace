-- User API keys for external providers (Anthropic, etc.) — encrypted at rest
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','revoked'))
);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id, status);
