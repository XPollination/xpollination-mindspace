-- Attestation rules configuration per project/capability
-- Rules versioned — agents receive rules_version in ATTESTATION_REQUIRED
CREATE TABLE IF NOT EXISTS attestation_rules (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES projects(slug),
  capability_id TEXT,
  from_status TEXT,
  to_status TEXT,
  rules TEXT NOT NULL DEFAULT '[]',  -- JSON array of rule definitions
  rules_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attestation_rules_project ON attestation_rules(project_slug);
CREATE INDEX IF NOT EXISTS idx_attestation_rules_capability ON attestation_rules(capability_id);
