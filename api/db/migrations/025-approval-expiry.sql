ALTER TABLE approval_requests ADD COLUMN expires_at TEXT DEFAULT (datetime('now', '+24 hours'));
-- Update status CHECK to include 'expired'
-- SQLite doesn't support ALTER CHECK, so we rely on application-level enforcement
-- The status column now allows: pending, approved, rejected, expired
