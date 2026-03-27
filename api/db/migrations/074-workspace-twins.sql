-- Workspace twins: portable cross-station workspaces
-- Part of Agent Experience mission — Workspace Twin capability
CREATE TABLE IF NOT EXISTS workspace_twins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  git_urls TEXT,
  branch_state TEXT,
  agent_sessions TEXT,
  permissions TEXT,
  decision_chain_refs TEXT,
  station_id TEXT,
  project_slug TEXT,
  status TEXT NOT NULL DEFAULT 'undocked' CHECK (status IN ('docked', 'undocked', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  cid TEXT
);
CREATE INDEX IF NOT EXISTS idx_workspace_twins_user ON workspace_twins(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_twins_status ON workspace_twins(status);
