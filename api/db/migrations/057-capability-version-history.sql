-- Capability version history: tracks version entries for each capability
-- Each row = one version release with changelog, contributing tasks, requirements satisfied

CREATE TABLE IF NOT EXISTS capability_version_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  version INTEGER NOT NULL,
  changelog TEXT,
  contributing_tasks TEXT,
  requirements_satisfied TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  pdsa_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_cap_version_history_cap ON capability_version_history(capability_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cap_version_history_cap_ver ON capability_version_history(capability_id, version);
