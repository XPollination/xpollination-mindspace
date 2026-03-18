-- Populate 3 missions from PLATFORM-001 v0.0.6
-- Missions are the WHY — they compose capabilities, not own them
-- Idempotent: INSERT OR IGNORE

INSERT OR IGNORE INTO missions (id, title, slug, description, status)
VALUES ('mission-fair-attribution',
        'Fair Attribution',
        'MISSION-FAIR-ATTR',
        'Measurable collaboration where every contribution is tracked and valued. Uses CAP-AUTH, CAP-PROVENANCE, CAP-TOKEN.',
        'active');

INSERT OR IGNORE INTO missions (id, title, slug, description, status)
VALUES ('mission-traversable-context',
        'Traversable Context',
        'MISSION-TRAV-CTX',
        'Decision context available at every level — from mission to task. Uses CAP-TASK-ENGINE, CAP-GRAPH, CAP-VIZ.',
        'active');

INSERT OR IGNORE INTO missions (id, title, slug, description, status)
VALUES ('mission-agent-human-collab',
        'Agent-Human Collaboration',
        'MISSION-AH-COLLAB',
        'Agents and humans work together without chaos. Uses CAP-AUTH (shared), CAP-AGENT-PROTOCOL, CAP-QUALITY, CAP-FOUNDATION.',
        'active');
