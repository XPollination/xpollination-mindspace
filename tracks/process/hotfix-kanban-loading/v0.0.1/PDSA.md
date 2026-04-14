# PDSA: hotfix-kanban-loading

## Plan
Replicate 7 hotfixes from prod container into feature branch via atomic commits.

## Do
7 atomic commits on feature/host-agent-runtime:
1. a2a-client.js — HEARTBEAT replaces HEAD for session validation
2. server.js — SSE proxy forwards request method
3. interface-cli.js — tasks table instead of mindspace_nodes
4. agent-monitor.cjs — tasks table
5. discover-projects.cjs — tasks table
6. SKILL.md — paths updated
7. agent-runtime.js — runner integration

## Study
All files were already modified on disk from docker cp hotfix. Commits replicate them into git flow.

## Act
Merge feature branch to develop, deploy to beta, rebuild prod image.
