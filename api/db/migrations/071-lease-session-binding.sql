-- Bind leases to agent sessions
ALTER TABLE leases ADD COLUMN session_id TEXT;
