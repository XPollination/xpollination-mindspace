CREATE TABLE IF NOT EXISTS user_project_settings (
  user_id TEXT NOT NULL,
  project_slug TEXT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_slug, key)
);
