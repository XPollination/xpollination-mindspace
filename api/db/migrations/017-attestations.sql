CREATE TABLE IF NOT EXISTS attestations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_slug TEXT,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  rules_version TEXT,
  valid INTEGER NOT NULL DEFAULT 0,
  required_checks TEXT NOT NULL DEFAULT '[]',
  submitted_checks TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'accepted', 'rejected')),
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attestations_task ON attestations(task_id);
CREATE INDEX IF NOT EXISTS idx_attestations_agent ON attestations(agent_id);
CREATE INDEX IF NOT EXISTS idx_attestations_status ON attestations(status);
