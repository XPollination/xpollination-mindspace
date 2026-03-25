-- Mission Lifecycle (SKO Part 1): Expand status CHECK + deprecate missions.
-- SQLite cannot ALTER CHECK — recreate table with new constraint.
-- migrate.ts auto-disables FK checks when it sees DROP TABLE.

CREATE TABLE missions_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'active', 'complete', 'deprecated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  slug TEXT,
  short_id TEXT,
  content_md TEXT,
  content_version INTEGER DEFAULT 0,
  project_slug TEXT REFERENCES projects(slug)
);

INSERT INTO missions_new (id, title, description, status, created_at, updated_at, slug, short_id, content_md, content_version, project_slug)
  SELECT id, title, description, status, created_at, updated_at, slug, short_id, content_md, content_version, project_slug
  FROM missions;

DROP TABLE missions;
ALTER TABLE missions_new RENAME TO missions;

-- Deprecate superseded missions per SKO Part 1
UPDATE missions SET status = 'deprecated' WHERE id IN (
  'mission-agent-human-collab',
  'mission-traversable-context',
  'mission-knowledge-space',
  'mission-mindspace',
  'mission-road-001'
);
