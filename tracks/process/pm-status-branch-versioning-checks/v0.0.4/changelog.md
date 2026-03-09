# Changelog: pm-status-branch-versioning-checks v0.0.4

## Changes from v0.0.3

- **Deployment verification**: Added 4th automated check — reads `viz/active` symlink, compares to latest `viz/versions/`, flags WARN when latest version exists but symlink not updated. Applies only to viz-related tasks in xpollination-mcp-server.
- **Preserved**: All v0.0.1-v0.0.3 changes (verification checks, visual hierarchy, style guide, HUMAN APPROVAL rename, AskUserQuestion for SEMI mode).
