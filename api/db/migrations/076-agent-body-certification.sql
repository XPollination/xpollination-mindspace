-- Add is_body column to agents table for A2A body certification.
-- Only certified bodies (xpo-agent.js) can open SSE streams.
-- Souls (LLMs) receive events via tmux send-keys from the body.
ALTER TABLE agents ADD COLUMN is_body INTEGER DEFAULT 0;
