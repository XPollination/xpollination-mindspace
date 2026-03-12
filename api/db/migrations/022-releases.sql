CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sealed')),
  created_by TEXT REFERENCES users(id),
  sealed_at TEXT,
  sealed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_slug, version)
);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_slug);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
