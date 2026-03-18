-- Bootstrap seed: system user + mindspace project
-- Satisfies FK constraints for hierarchy tables
-- Idempotent: INSERT OR IGNORE

-- Step 1: System user (no password, cannot login)
INSERT OR IGNORE INTO users (id, email, password_hash, name)
VALUES ('system', 'system@mindspace.local', 'nologin', 'System');

-- Step 2: Mindspace project (FK to system user)
INSERT OR IGNORE INTO projects (id, slug, name, description, created_by)
VALUES ('proj-mindspace', 'mindspace', 'Mindspace', 'XPollination Mindspace platform', 'system');
