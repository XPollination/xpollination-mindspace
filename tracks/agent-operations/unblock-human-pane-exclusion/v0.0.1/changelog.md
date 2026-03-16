# Changelog: unblock-human-pane-exclusion v0.0.1

## Summary
Excluded pane 0 (LIAISON/human) from claude-unblock.sh default agents mode to prevent input corruption.

## Changes
- Removed [0]=LIAISON from agents PANES array (line 266), now panes 1-3 only
- Banner updated to say "AGENT PANES mode (panes 1-3)"
- Added explicit `all` mode for opt-in full-pane monitoring including pane 0
- Header comments updated to document agents=panes 1-3
- Help text documents `all` mode

## Commits
- xpollination-mcp-server: 07d3a66 (feature/auth-e2e)

## Verification
- 10/10 tests pass (ms-unblock-human-pane-exclusion.test.ts)
- QA: PASS
- PDSA: PASS
