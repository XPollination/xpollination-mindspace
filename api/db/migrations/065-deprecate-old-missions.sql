-- Mission Lifecycle (SKO Part 1): Expand status CHECK + deprecate superseded missions.
-- Original CHECK: draft, active, complete, cancelled
-- New CHECK: + ready, deprecated (required for Mission Lifecycle Kanban)

-- SQLite cannot ALTER CHECK constraints — recreate table with expanded constraint.
CREATE TABLE missions_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'active', 'complete', 'deprecated', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  project_slug TEXT REFERENCES projects(slug)
);

INSERT INTO missions_new SELECT * FROM missions;
DROP TABLE missions;
ALTER TABLE missions_new RENAME TO missions;

-- Now deprecate superseded missions.
UPDATE missions SET status = 'deprecated' WHERE id IN (
  'mission-agent-human-collab',
  'mission-traversable-context',
  'mission-knowledge-space',
  'mission-mindspace',
  'mission-road001'
);

-- Keep active: mission-self-healing, mission-fair-attribution
-- Keep active: mission-structured-knowledge, mission-continuous-delivery, mission-twin-protocol, etc.
