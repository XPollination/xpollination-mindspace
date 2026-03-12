CREATE TABLE IF NOT EXISTS capability_requirements (
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  requirement_ref TEXT NOT NULL,
  PRIMARY KEY (capability_id, requirement_ref)
);

CREATE TABLE IF NOT EXISTS capability_tasks (
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  task_slug TEXT NOT NULL,
  PRIMARY KEY (capability_id, task_slug)
);

CREATE INDEX IF NOT EXISTS idx_capability_requirements_capability ON capability_requirements(capability_id);
CREATE INDEX IF NOT EXISTS idx_capability_tasks_capability ON capability_tasks(capability_id);
