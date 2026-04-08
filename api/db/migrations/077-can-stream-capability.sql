-- Capability-based SSE gating (replaces is_body from 076).
-- can_stream is set server-side at connect time based on auth method.
-- See api/routes/SECURITY.md for the full security model.
ALTER TABLE agents ADD COLUMN can_stream INTEGER DEFAULT 0;
