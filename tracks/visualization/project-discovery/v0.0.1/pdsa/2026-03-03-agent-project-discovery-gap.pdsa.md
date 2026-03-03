# PDSA: Agent-Viz Project Discovery Gap

**Track:** visualization/project-discovery
**Version:** v0.0.1
**Date:** 2026-03-03
**Status:** Plan
**Actor:** PDSA agent
**Task:** agent-project-discovery-gap

## Context

The viz server auto-discovers projects by scanning the workspace for `data/xpollination.db`. Agent tooling (monitor, hooks, skills) has a mix — `agent-monitor.cjs` was already updated to auto-discover, but `pm-status.cjs`, `precompact-save.sh`, and `SKILL.md` still use hardcoded DB paths. Additionally, ghost projects appear in discovery: `xpollination-hive` (618KB, old renamed repo) and `xpollination-best-practices` (0 bytes, empty file).

The larger vision: xpollination becomes a self-contained, downloadable project. Users configure ONE workspace path, and everything auto-discovers from there. No hardcoded lists.

## Current State (Investigation Results)

### Discovery Mechanisms

| Component | Method | Hardcoded? |
|-----------|--------|------------|
| `viz/server.js` | Scans `WORKSPACE_PATH` for `data/xpollination.db` | No — auto-discovers |
| `viz/agent-monitor.cjs` | Same scan pattern as server.js | No — auto-discovers (v0.0.2) |
| `viz/pm-status.cjs` | Hardcoded `DBS` object (3 paths) | **YES — includes stale `best-practices` path** |
| `scripts/precompact-save.sh` | Hardcoded for-loop (3 paths) | **YES** |
| `SKILL.md` (xpo.claude.monitor) | Hardcoded list of 3 project DBs | **YES** |

### Ghost Projects in Discovery

| Project | DB Size | Status |
|---------|---------|--------|
| `xpollination-hive` | 618KB | Ghost — old name before rename to xpollination-best-practices. Has real data (tasks from before rename) |
| `xpollination-best-practices` | 0 bytes | Empty file — never initialized with schema |

Both show in viz project dropdown. `xpollination-hive` shows real (but stale) tasks. `xpollination-best-practices` may error on load.

### WORKSPACE_PATH

Currently hardcoded as `/home/developer/workspaces/github/PichlerThomas` in:
- `viz/server.js` line 17
- `viz/agent-monitor.cjs` line 29

This is correct for the current server but won't work when the project is downloaded elsewhere.

## Plan

### 1. Unified Discovery Function (shared module)

Create a single `discover-projects.cjs` module used by ALL components:

```javascript
// viz/discover-projects.cjs
const fs = require('fs');
const path = require('path');

const DEFAULT_WORKSPACE = process.env.XP_WORKSPACE_PATH
  || '/home/developer/workspaces/github/PichlerThomas';

function discoverProjects(workspacePath = DEFAULT_WORKSPACE) {
  const discovered = [];
  const dirs = fs.readdirSync(workspacePath);
  for (const dir of dirs) {
    const projectPath = path.join(workspacePath, dir);
    const dbPath = path.join(projectPath, 'data', 'xpollination.db');
    try {
      if (!fs.statSync(projectPath).isDirectory()) continue;
    } catch { continue; }
    if (fs.existsSync(dbPath)) {
      // Filter: DB must be >0 bytes (skip empty placeholder files)
      const stat = fs.statSync(dbPath);
      if (stat.size === 0) continue;
      discovered.push({ name: dir, path: projectPath, dbPath });
    }
  }
  return discovered;
}

module.exports = { discoverProjects, DEFAULT_WORKSPACE };
```

**Key decisions:**
- `XP_WORKSPACE_PATH` env var for portability (default falls back to current server path)
- Filter out 0-byte DBs (ghost projects like `xpollination-best-practices`)
- CJS module (not ESM) for compatibility with all consumers (`.cjs` files and bash scripts via `node -e`)

### 2. Update Consumers

**`viz/pm-status.cjs`** — Replace hardcoded `DBS` object:
```javascript
const { discoverProjects } = require('./discover-projects.cjs');
const projects = discoverProjects();
// projects already has { name, dbPath } — use directly
```

**`viz/agent-monitor.cjs`** — Already has its own `discoverProjects()`. Replace with shared module:
```javascript
const { discoverProjects, DEFAULT_WORKSPACE } = require('./discover-projects.cjs');
const CLI_PATH = path.join(DEFAULT_WORKSPACE, 'xpollination-mcp-server/src/db/interface-cli.js');
const projects = discoverProjects().map(p => ({ ...p, cliPath: CLI_PATH }));
```

**`viz/server.js`** — ESM file, needs dynamic import or path-based approach. Two options:
- Option A: Convert to `import { discoverProjects } from './discover-projects.mjs'` (requires ESM version)
- Option B: Use `createRequire` to import CJS from ESM
- **Recommendation: Option B** — `createRequire` is simpler and avoids maintaining two versions:
```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { discoverProjects } = require('./discover-projects.cjs');
```

**`scripts/precompact-save.sh`** — Use `node -e` with the shared module:
```bash
# Replace hardcoded for-loop with dynamic discovery
PROJECT_DBS=$(node -e "
  const { discoverProjects } = require('$BASE/xpollination-mcp-server/viz/discover-projects.cjs');
  discoverProjects().forEach(p => console.log(p.dbPath));
")
```

**`SKILL.md` (xpo.claude.monitor)** — Replace hardcoded list with instruction:
```
Project databases are auto-discovered from workspace. The --wait output includes
project name and DB path for each task. Use those values directly.
```
The agent already gets the correct DB path from `--wait` output — the hardcoded list in SKILL.md is documentation-only and can be removed.

### 3. Ghost Project Cleanup

- **`xpollination-best-practices/data/xpollination.db`** — 0 bytes. The >0 bytes filter in `discoverProjects()` handles this automatically. No action needed.
- **`xpollination-hive`** — 618KB with real data. This is a legacy repo. Two options:
  - Option A: Delete the DB file (data is stale)
  - Option B: Delete the entire `xpollination-hive` directory if no longer needed
  - **Recommendation:** This is a human decision. PDSA flags it, LIAISON presents to Thomas.

### 4. Workspace Path Configuration

The `XP_WORKSPACE_PATH` env var should be:
- Set in `claude-session.sh` via `tmux set-environment` (same pattern as `BRAIN_API_KEY`)
- Default fallback to hardcoded current path for backward compatibility
- In future downloadable version: set during initial setup

### Acceptance Criteria Mapping

| AC | How Met |
|----|---------|
| Single configurable workspace path | `XP_WORKSPACE_PATH` env var with default fallback |
| Auto-discovery by scanning for `data/xpollination.db` | `discoverProjects()` in shared module |
| Same discovery mechanism everywhere | All 4 consumers use `discover-projects.cjs` |
| Agent aware of all discovered projects | `--wait` output includes project name + DB path |
| No hardcoded DB paths | All hardcoded paths replaced with shared module calls |
| Empty/invalid DBs handled | >0 bytes filter removes empty DBs |
| Self-contained downloadable design | `XP_WORKSPACE_PATH` is the only config needed |
| Adding/removing project auto-updates | Directory scan runs on every invocation |

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `viz/discover-projects.cjs` | CREATE | Shared discovery module |
| `viz/pm-status.cjs` | EDIT | Replace hardcoded DBS with shared module |
| `viz/agent-monitor.cjs` | EDIT | Replace local discoverProjects with shared module |
| `viz/server.js` | EDIT | Use shared module via createRequire |
| `scripts/precompact-save.sh` (best-practices) | EDIT | Replace hardcoded for-loop |
| `SKILL.md` (xpo.claude.monitor) | EDIT | Remove hardcoded DB list, note auto-discovery |
| `claude-session.sh` (HomeAssistant) | EDIT | Add `XP_WORKSPACE_PATH` to tmux env |

### Risk Assessment

- **Low risk:** All auto-discovery changes are backward compatible (default path = current path)
- **Medium risk:** `precompact-save.sh` uses `node -e` which adds node as dependency for bash hooks (already present via nvm)
- **No risk:** Ghost project filtering — >0 bytes check is safe (real DBs are always >0)

## Do

_To be filled during implementation_

## Study

_To be filled after implementation_

## Act

_To be filled after study_
