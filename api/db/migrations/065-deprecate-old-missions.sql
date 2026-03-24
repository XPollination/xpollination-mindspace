-- Mission Lifecycle (SKO Part 1): Deprecate superseded missions.
-- Capabilities are now composed by Structured Knowledge Objects and other active missions.

UPDATE missions SET status = 'deprecated' WHERE id IN (
  'mission-agent-human-collab',
  'mission-traversable-context',
  'mission-knowledge-space',
  'mission-mindspace',
  'mission-road001'
);

-- Keep active: mission-self-healing, mission-fair-attribution
-- Keep active: mission-structured-knowledge, mission-continuous-delivery, mission-twin-protocol, etc.
