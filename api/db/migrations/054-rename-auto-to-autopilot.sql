-- Rename 'auto' and 'auto-approval' to 'autopilot' in liaison approval mode settings
-- Communicates LIAISON takes responsibility, not rubber-stamps

-- System-wide setting
UPDATE system_settings SET value = 'autopilot' WHERE key = 'liaison_approval_mode' AND value = 'auto';
UPDATE system_settings SET value = 'autopilot' WHERE key = 'liaison_approval_mode' AND value = 'auto-approval';

-- Per-project per-user settings
UPDATE user_project_settings SET value = 'autopilot' WHERE key = 'liaison_approval_mode' AND value = 'auto';
UPDATE user_project_settings SET value = 'autopilot' WHERE key = 'liaison_approval_mode' AND value = 'auto-approval';

-- Triggers: auto-convert 'auto' to 'autopilot' on future inserts/updates (backward compat)
CREATE TRIGGER IF NOT EXISTS trg_system_settings_auto_to_autopilot
AFTER INSERT ON system_settings
WHEN NEW.key = 'liaison_approval_mode' AND (NEW.value = 'auto' OR NEW.value = 'auto-approval')
BEGIN
  UPDATE system_settings SET value = 'autopilot' WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS trg_system_settings_auto_to_autopilot_update
AFTER UPDATE ON system_settings
WHEN NEW.key = 'liaison_approval_mode' AND (NEW.value = 'auto' OR NEW.value = 'auto-approval')
BEGIN
  UPDATE system_settings SET value = 'autopilot' WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS trg_user_project_settings_auto_to_autopilot
AFTER INSERT ON user_project_settings
WHEN NEW.key = 'liaison_approval_mode' AND (NEW.value = 'auto' OR NEW.value = 'auto-approval')
BEGIN
  UPDATE user_project_settings SET value = 'autopilot' WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS trg_user_project_settings_auto_to_autopilot_update
AFTER UPDATE ON user_project_settings
WHEN NEW.key = 'liaison_approval_mode' AND (NEW.value = 'auto' OR NEW.value = 'auto-approval')
BEGIN
  UPDATE user_project_settings SET value = 'autopilot' WHERE rowid = NEW.rowid;
END;
