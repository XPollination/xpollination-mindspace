-- Add dna_json column to tasks table for legacy DNA payload preservation
ALTER TABLE tasks ADD COLUMN dna_json TEXT;

-- Add slug column for legacy task identification (maps to mindspace_nodes.slug)
ALTER TABLE tasks ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);
