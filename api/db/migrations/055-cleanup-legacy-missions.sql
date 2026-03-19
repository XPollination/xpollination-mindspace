-- Cleanup legacy missions: reassign orphaned capabilities, delete duplicates
-- FK-safe order: reassign first, then delete

-- Reassign capabilities from legacy missions to agent-human-collab (catch-all)
UPDATE capabilities SET mission_id = 'mission-agent-human-collab'
  WHERE mission_id NOT IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab')
  AND mission_id IN (SELECT id FROM missions);

-- Delete legacy missions (only those not in PLATFORM-001)
DELETE FROM missions WHERE id NOT IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab');
