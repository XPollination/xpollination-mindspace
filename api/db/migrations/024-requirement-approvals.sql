CREATE TABLE IF NOT EXISTS requirement_approvals (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'expired')),
  requested_by TEXT REFERENCES users(id),
  confirmed_by TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_req_approvals_requirement ON requirement_approvals(requirement_id);
CREATE INDEX IF NOT EXISTS idx_req_approvals_token ON requirement_approvals(token);
