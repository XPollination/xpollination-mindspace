-- Mindspace Mission Seed — idempotent (INSERT OR IGNORE)

-- Mission: Mindspace Platform
INSERT OR IGNORE INTO missions (id, title, description, status)
VALUES ('mission-mindspace', 'Mindspace Platform', 'Collaborative intelligence platform — humans and agents building knowledge together', 'active');

-- 10 Capabilities
INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES
  ('cap-foundation', 'mission-mindspace', 'CAP-FOUNDATION', 'Core infrastructure: database, server, deployment, versioning', 'active', 1),
  ('cap-auth', 'mission-mindspace', 'CAP-AUTH', 'Authentication: login, registration, invite system, JWT, session management', 'active', 2),
  ('cap-task-engine', 'mission-mindspace', 'CAP-TASK-ENGINE', 'Task workflow engine: state machine, transitions, gates, DNA', 'active', 3),
  ('cap-agent-protocol', 'mission-mindspace', 'CAP-AGENT-PROTOCOL', 'Agent protocol: monitor skill, recovery, working memory, continuity', 'active', 4),
  ('cap-org-brain', 'mission-mindspace', 'CAP-ORG-BRAIN', 'Organizational brain: knowledge storage, retrieval, gardening', 'active', 5),
  ('cap-quality', 'mission-mindspace', 'CAP-QUALITY', 'Quality gates: test pass, version bump, PDSA, liaison review', 'active', 6),
  ('cap-integration', 'mission-mindspace', 'CAP-INTEGRATION', 'Integration: API endpoints, Viz-to-API migration, Docker', 'active', 7),
  ('cap-requirements', 'mission-mindspace', 'CAP-REQUIREMENTS', 'Requirements management: versioning, approvals, traceability', 'active', 8),
  ('cap-marketplace', 'mission-mindspace', 'CAP-MARKETPLACE', 'A2A marketplace: agent discovery, service exchange', 'active', 9),
  ('cap-release', 'mission-mindspace', 'CAP-RELEASE', 'Release management: branch strategy, deployment, rollback', 'active', 10);
