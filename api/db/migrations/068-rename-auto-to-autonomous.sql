-- Rename approval mode: auto → autonomous (decided 2026-03-19, applied 2026-03-25)
-- Modes are now: manual, semi, auto-approval, autonomous

UPDATE system_settings SET value = 'autonomous' WHERE key = 'liaison_approval_mode' AND value = 'auto';
UPDATE system_settings SET value = 'autonomous' WHERE key = 'liaison_approval_mode' AND value = 'autopilot';

-- user_project_settings may not exist in all environments
UPDATE user_project_settings SET value = 'autonomous' WHERE key = 'liaison_approval_mode' AND value = 'auto';
UPDATE user_project_settings SET value = 'autonomous' WHERE key = 'liaison_approval_mode' AND value = 'autopilot';
