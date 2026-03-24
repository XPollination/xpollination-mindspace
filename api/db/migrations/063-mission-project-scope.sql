-- Scope missions to projects (Mission Lifecycle from SKO).
-- Missions were global — now each mission belongs to a project.
-- Existing missions assigned to 'xpollination-mindspace' (the main project).

ALTER TABLE missions ADD COLUMN project_slug TEXT REFERENCES projects(slug);

-- Assign all existing missions to xpollination-mindspace
UPDATE missions SET project_slug = 'xpollination-mindspace';
