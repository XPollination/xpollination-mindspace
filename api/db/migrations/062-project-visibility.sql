-- Add visibility column to projects (public/private foundation)
-- Public = free, open brain. Private = licensed, local brain (future).
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK(visibility IN ('public', 'private'));
