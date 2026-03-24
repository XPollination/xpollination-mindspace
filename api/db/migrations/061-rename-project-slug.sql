-- Rename project: xpollination-mcp-server → xpollination-mindspace
-- Strategy: INSERT new slug → UPDATE children → DELETE old slug
-- This avoids FK violations because children always point to a valid project.

-- 1. Create the new project entry (new UUID, copy fields from old)
INSERT INTO projects (id, slug, name, description, created_at, created_by, has_org_brain, org_brain_collection, git_url)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
  'xpollination-mindspace', 'XPollination Mindspace', description, created_at, created_by, has_org_brain, org_brain_collection, 'https://github.com/XPollination/xpollination-mindspace.git'
FROM projects WHERE slug = 'xpollination-mcp-server';

-- 2. Point all children to the new slug (new slug exists, so FK is satisfied)
UPDATE tasks SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE requirements SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE project_access SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE agents SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE project_focus SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE attestations SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE feature_flags SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE marketplace_announcements SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE marketplace_requests SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE bug_reports SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE releases SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE requirement_approvals SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE attestation_rules SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE suspect_links SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE approval_requests SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';
UPDATE user_project_settings SET project_slug = 'xpollination-mindspace' WHERE project_slug = 'xpollination-mcp-server';

-- 3. Delete the old project entry (no children reference it anymore)
DELETE FROM projects WHERE slug = 'xpollination-mcp-server';
