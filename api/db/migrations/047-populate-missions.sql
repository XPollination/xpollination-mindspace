-- Populate 3 missions from PLATFORM-001 v0.0.6
-- Missions are the WHY — they compose capabilities, not own them
-- Idempotent: INSERT OR IGNORE
-- Prerequisite: migration 045 (adds slug column to missions)

INSERT OR IGNORE INTO missions (id, title, description, status)
VALUES ('mission-fair-attribution',
        'Fair Attribution',
        'Measurable collaboration where every contribution is tracked and valued. Uses CAP-AUTH, CAP-PROVENANCE, CAP-TOKEN.',
        'active');

INSERT OR IGNORE INTO missions (id, title, description, status)
VALUES ('mission-traversable-context',
        'Traversable Context',
        'Decision context available at every level — from mission to task. Uses CAP-TASK-ENGINE, CAP-GRAPH, CAP-VIZ.',
        'active');

INSERT OR IGNORE INTO missions (id, title, description, status)
VALUES ('mission-agent-human-collab',
        'Agent-Human Collaboration',
        'Agents and humans work together without chaos. Uses CAP-AUTH (shared), CAP-AGENT-PROTOCOL, CAP-QUALITY, CAP-FOUNDATION.',
        'active');

-- Set slugs (slug column added by migration 045)
UPDATE missions SET slug = 'MISSION-FAIR-ATTR' WHERE id = 'mission-fair-attribution' AND (slug IS NULL OR slug = '');
UPDATE missions SET slug = 'MISSION-TRAV-CTX' WHERE id = 'mission-traversable-context' AND (slug IS NULL OR slug = '');
UPDATE missions SET slug = 'MISSION-AH-COLLAB' WHERE id = 'mission-agent-human-collab' AND (slug IS NULL OR slug = '');
