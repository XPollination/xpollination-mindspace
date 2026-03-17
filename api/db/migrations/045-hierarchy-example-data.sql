-- Add slug to missions for human-readable references
ALTER TABLE missions ADD COLUMN slug TEXT;

-- Add capability_id to requirements for linking
ALTER TABLE requirements ADD COLUMN capability_id TEXT REFERENCES capabilities(id);

-- Seed ROAD-001 mission with slug
UPDATE missions SET slug = 'ROAD-001' WHERE id = 'mission-mindspace';
INSERT OR IGNORE INTO missions (id, title, slug, description, status)
VALUES ('mission-road-001', 'ROAD-001: Mindspace v1.0', 'ROAD-001', 'First production release of Mindspace', 'active');

-- Link requirements to capabilities
UPDATE requirements SET capability_id = 'cap-auth' WHERE req_id_human = 'REQ-AUTH';
UPDATE requirements SET capability_id = 'cap-task-engine' WHERE req_id_human = 'REQ-WORKFLOW';
UPDATE requirements SET capability_id = 'cap-integration' WHERE req_id_human = 'REQ-VIZ';
UPDATE requirements SET capability_id = 'cap-agent-protocol' WHERE req_id_human = 'REQ-A2A';
UPDATE requirements SET capability_id = 'cap-org-brain' WHERE req_id_human = 'REQ-BRAIN';

-- Seed a task with requirement_refs in DNA
INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('system', 'system@mindspace.local', 'nologin', 'System');
INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES ('proj-system', 'system-default', 'System Default', 'Seed', 'system');
INSERT OR IGNORE INTO tasks (id, project_slug, title, status, dna, slug)
VALUES ('task-example-linked', 'system-default', 'Example linked task', 'complete',
  '{"requirement_refs":["REQ-AUTH","REQ-WORKFLOW"],"title":"Example linked task"}', 'example-linked-task');
