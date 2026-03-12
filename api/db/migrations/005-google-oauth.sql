-- Rebuild users table to make password_hash nullable and add google_id
-- SQLite does not support ALTER COLUMN, so we rebuild

CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  google_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, name, created_at)
SELECT id, email, password_hash, name, created_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;
