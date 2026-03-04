# Changelog: Agent-Project Discovery Gap — v0.0.2

## Changes
- Created shared `viz/discover-projects.cjs` module as single source of truth for project auto-discovery
- Uses `XPO_WORKSPACE_PATH` env var with fallback to default workspace path
- Scans for `data/xpollination.db`, filters zero-byte ghost DBs
- Refactored `server.js` to use shared module (-35 lines of inline discovery)
- Refactored `agent-monitor.cjs` to use shared module (-27 lines)
- Refactored `pm-status.cjs` to use shared module (-14 lines)
- Fixed `guessProject()` in `interface-cli.js` to dynamically extract project name from path (no hardcoded names)

## Known Gaps (follow-up needed)
- `precompact-save.sh` still uses hardcoded DB paths (best-practices repo)
- `SKILL.md` (xpo.claude.monitor) still lists hardcoded DB paths (best-practices repo)

## Date
2026-03-04
