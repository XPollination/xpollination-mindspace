CREATE TABLE IF NOT EXISTS marketplace_requests (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('feature', 'integration', 'service', 'data')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'matched', 'fulfilled', 'closed')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_requests_project ON marketplace_requests(project_slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_requests_status ON marketplace_requests(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_requests_category ON marketplace_requests(category);
