CREATE TABLE IF NOT EXISTS task_transitions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor TEXT,
  actor_role TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_transitions_task ON task_transitions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_transitions_created ON task_transitions(created_at);
