-- Re-approval workflow: add type and suspect_link_id, make task_id nullable
-- SQLite requires table recreation to change NOT NULL constraint

CREATE TABLE IF NOT EXISTS approval_requests_new (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  requested_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  reason TEXT,
  type TEXT NOT NULL DEFAULT 'standard',
  suspect_link_id TEXT REFERENCES suspect_links(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO approval_requests_new (id, task_id, project_slug, requested_by, status, decided_by, decided_at, reason, type, suspect_link_id, created_at)
  SELECT id, task_id, project_slug, requested_by, status, decided_by, decided_at, reason, 'standard', NULL, created_at FROM approval_requests;

DROP TABLE IF EXISTS approval_requests;
ALTER TABLE approval_requests_new RENAME TO approval_requests;

CREATE INDEX IF NOT EXISTS idx_approval_requests_task ON approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_project ON approval_requests(project_slug);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_suspect ON approval_requests(suspect_link_id);
