CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'released'))
);
CREATE INDEX IF NOT EXISTS idx_leases_task ON leases(task_id);
CREATE INDEX IF NOT EXISTS idx_leases_user ON leases(user_id);
