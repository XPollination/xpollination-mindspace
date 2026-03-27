-- Decision twins: immutable decision chains with full conversation traceability
-- Part of Agent Experience mission — Decision Interface capability
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  task_ref TEXT,
  mission_ref TEXT,
  frame TEXT NOT NULL,
  options TEXT NOT NULL,
  human_prompt TEXT,
  agent_response TEXT,
  choice TEXT,
  reasoning TEXT,
  resolved_by TEXT,
  requesting_agent TEXT,
  chain_parent_cid TEXT,
  brain_thought_ids TEXT,
  project_slug TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'expired', 'cancelled')),
  pending_transition TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  cid TEXT
);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_ref);
CREATE INDEX IF NOT EXISTS idx_decisions_chain ON decisions(chain_parent_cid);
