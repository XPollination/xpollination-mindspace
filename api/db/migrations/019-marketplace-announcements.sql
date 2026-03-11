CREATE TABLE IF NOT EXISTS marketplace_announcements (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('feature', 'integration', 'service', 'data')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'withdrawn')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_announcements_project ON marketplace_announcements(project_slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_announcements_status ON marketplace_announcements(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_announcements_category ON marketplace_announcements(category);
