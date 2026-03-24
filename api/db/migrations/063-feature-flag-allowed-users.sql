-- Feature flag per-user access control
-- NULL = all project members, JSON array = only those user IDs
ALTER TABLE feature_flags ADD COLUMN allowed_user_ids TEXT DEFAULT NULL;
