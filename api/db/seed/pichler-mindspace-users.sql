-- Seed Pichler-Mindspace users
-- Idempotent: INSERT OR IGNORE prevents duplicates

INSERT OR IGNORE INTO users (id, username, display_name, role)
VALUES ('thomas-pichler', 'thomas', 'Thomas Pichler', 'admin');

INSERT OR IGNORE INTO users (id, username, display_name, role)
VALUES ('maria-pichler', 'maria', 'Maria Pichler', 'contributor');

-- Grant project access for pichler-mindspace
INSERT OR IGNORE INTO project_members (id, project_slug, user_id, role)
VALUES ('pm-thomas-pichler-ms', 'pichler-mindspace', 'thomas-pichler', 'admin');

INSERT OR IGNORE INTO project_members (id, project_slug, user_id, role)
VALUES ('pm-maria-pichler-ms', 'pichler-mindspace', 'maria-pichler', 'contributor');
