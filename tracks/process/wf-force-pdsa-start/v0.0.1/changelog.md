# Changelog: wf-force-pdsa-start v0.0.1

## Summary
Removed direct pending→ready:dev shortcut so all tasks must go through PDSA planning first.

## Changes
- Generic pending→ready now sets newRole:pdsa for task type (workflow-engine.js:35)
- Removed pending→ready:dev shortcut variant from active transitions
- Bug type pending→ready keeps newRole:dev (unchanged, line 107)
- Added console.warn fallback log in interface-cli.js:553 when role-specific transition falls back to generic

## Commits
- xpollination-mcp-server: 79164d6 (feature/auth-e2e)

## Verification
- 4/4 tests pass (ms-wf-force-pdsa-start.test.ts)
- QA: PASS
- PDSA: PASS
