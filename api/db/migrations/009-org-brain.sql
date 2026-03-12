-- Add organization brain columns to projects table
ALTER TABLE projects ADD COLUMN has_org_brain BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN org_brain_collection TEXT;
