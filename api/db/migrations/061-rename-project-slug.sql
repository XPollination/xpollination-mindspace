-- Rename project: xpollination-mcp-server → xpollination-mindspace
-- GitHub repo was renamed. Cascade slug change to all 16 FK-referencing tables.
-- FK enforcement temporarily disabled for the cascade.

PRAGMA foreign_keys = OFF;

-- 1. Rename the project itself
UPDATE projects SET
  slug = 'xpollination-mindspace',
  name = 'XPollination Mindspace',
  git_url = 'https://github.com/XPollination/xpollination-mindspace.git'
WHERE slug = 'xpollination-mcp-server';

-- 2. Cascade to ALL referencing tables
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

PRAGMA foreign_keys = ON;
