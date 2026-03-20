-- Seed node_relationships from existing FK data
-- COMPOSES: mission→capability (from capabilities.mission_id)
-- IMPLEMENTS: capability→requirement (from requirements.capability_id)
-- Idempotent: INSERT OR IGNORE respects UNIQUE constraint

-- Mission COMPOSES Capability (from capabilities.mission_id FK)
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
SELECT 'mission', c.mission_id, 'COMPOSES', 'capability', c.id, 'system'
FROM capabilities c
WHERE c.mission_id IS NOT NULL;

-- Capability IMPLEMENTS Requirement (from requirements.capability_id FK)
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
SELECT 'capability', r.capability_id, 'IMPLEMENTS', 'requirement', r.id, 'system'
FROM requirements r
WHERE r.capability_id IS NOT NULL;

-- Multi-mission: CAP-AUTH also composes under Fair Attribution (shared capability)
-- Per PLATFORM-001: CAP-AUTH serves both Agent-Human Collaboration AND Fair Attribution
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
VALUES ('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-auth', 'system');

-- Reverse direction: capability COMPOSES (serves) mission — for cross-reference queries from capability perspective
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
SELECT 'capability', c.id, 'COMPOSES', 'mission', c.mission_id, 'system'
FROM capabilities c
WHERE c.mission_id IS NOT NULL;

-- CAP-AUTH serves Fair Attribution too (multi-mission from capability perspective)
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
VALUES ('capability', 'cap-auth', 'COMPOSES', 'mission', 'mission-fair-attribution', 'system');
