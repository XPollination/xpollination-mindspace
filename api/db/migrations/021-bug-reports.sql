CREATE TABLE IF NOT EXISTS bug_reports (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'closed')),
  task_id TEXT REFERENCES tasks(id),
  reported_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_project ON bug_reports(project_slug);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(project_slug, status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(project_slug, severity);
