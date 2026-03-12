-- Suspect links: track downstream artifacts that may need re-validation
-- when upstream requirements/decisions change
CREATE TABLE IF NOT EXISTS suspect_links (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('requirement', 'code', 'test', 'decision')),
  source_ref TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('requirement', 'code', 'test', 'decision')),
  target_ref TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'suspect' CHECK(status IN ('suspect', 'cleared', 'accepted_risk')),
  project_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  cleared_by TEXT,
  cleared_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_suspect_links_project ON suspect_links(project_slug);
CREATE INDEX IF NOT EXISTS idx_suspect_links_status ON suspect_links(status);
CREATE INDEX IF NOT EXISTS idx_suspect_links_source ON suspect_links(source_type, source_ref);
CREATE INDEX IF NOT EXISTS idx_suspect_links_target ON suspect_links(target_type, target_ref);
