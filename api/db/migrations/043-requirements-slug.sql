-- Add slug column to requirements for unified access
ALTER TABLE requirements ADD COLUMN slug TEXT;

-- Create system user for seed data FK references
INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('system', 'system@mindspace.local', 'nologin', 'System');
INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES ('proj-system', 'system-default', 'System Default', 'Seed data project', 'system');

-- Seed REQ-* requirements
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, slug, title, status, priority, created_by)
VALUES
  ('req-auth', 'system-default', 'REQ-AUTH', 'REQ-AUTH', 'REQ-AUTH: Authentication', 'active', 'critical', 'system'),
  ('req-workflow', 'system-default', 'REQ-WORKFLOW', 'REQ-WORKFLOW', 'REQ-WORKFLOW: Workflow Engine', 'active', 'critical', 'system');
