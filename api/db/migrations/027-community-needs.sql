-- Community needs harvest tracking
-- Status lifecycle: unharvested -> under_consideration -> planned -> implemented | declined
CREATE TABLE IF NOT EXISTS community_needs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  description TEXT,
  thought_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of brain thought IDs
  count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unharvested'
    CHECK(status IN ('unharvested', 'under_consideration', 'planned', 'implemented', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_community_needs_status ON community_needs(status);
CREATE INDEX IF NOT EXISTS idx_community_needs_topic ON community_needs(topic);
