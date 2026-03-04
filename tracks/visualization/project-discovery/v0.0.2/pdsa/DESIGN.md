# PDSA: Agent-Viz Project Discovery Gap — v0.0.2

## REWORK CONTEXT

> **Liaison rework (2026-03-04):**
> "This design is from March 3rd and was blocked waiting for viz refactor. The viz has since gone through v0.0.1 to v0.0.4 with major structural changes. PDSA must review the existing v0.0.1 design against the CURRENT state of the codebase."

v0.0.1 design assumed 4 hardcoded consumers. Since then, 3 of 4 were independently updated to auto-discover. This v0.0.2 reflects the current state and addresses only the remaining gaps.

## PLAN

### Current State (March 4 Audit)

| Component | Discovery | Status |
|-----------|-----------|--------|
| `viz/server.js` | `XPO_WORKSPACE_PATH` + scan | Already auto-discovers |
| `viz/agent-monitor.cjs` | `XPO_WORKSPACE_PATH` + scan | Already auto-discovers |
| `viz/pm-status.cjs` | `XPO_WORKSPACE_PATH` + scan | Already auto-discovers |
| `viz/discover-projects.cjs` | — | Does NOT exist |
| `scripts/precompact-save.sh` | Hardcoded 3-path for-loop | **STILL HARDCODED** |
| `SKILL.md` (xpo.claude.monitor) | Hardcoded 3-project list | **STILL HARDCODED (docs)** |
| `interface-cli.js guessProject()` | Hardcoded 3 if-chains | **STILL HARDCODED** |

**Key change from v0.0.1:** The 3 main consumers (server.js, agent-monitor.cjs, pm-status.cjs) each have their OWN copy of the discovery function. They all work but there's code duplication (~20 lines x 3).

### What Changed Since v0.0.1

1. `pm-status.cjs` was updated to auto-discover (was hardcoded in v0.0.1)
2. `xpollination-best-practices/data/xpollination.db` grew from 0 bytes to 28K (now valid)
3. `xpollination-hive` still exists (616K) — appears in viz but is legacy/stale
4. Viz went through v0.0.1 to v0.0.4 (Kanban board, versioned dirs, changelog, light mode)
5. `XPO_WORKSPACE_PATH` env var is already used by all 3 auto-discover consumers

### Remaining Gaps (v0.0.2 Scope)

#### 1. Extract Shared Discovery Module

Create `viz/discover-projects.cjs` to eliminate duplication:

```javascript
// viz/discover-projects.cjs
const fs = require('fs');
const path = require('path');

const DEFAULT_WORKSPACE = process.env.XPO_WORKSPACE_PATH
  || '/home/developer/workspaces/github/PichlerThomas';

function discoverProjects(workspacePath = DEFAULT_WORKSPACE) {
  const discovered = [];
  let dirs;
  try { dirs = fs.readdirSync(workspacePath); } catch { return discovered; }
  for (const dir of dirs) {
    const projectPath = path.join(workspacePath, dir);
    const dbPath = path.join(projectPath, 'data', 'xpollination.db');
    try {
      if (!fs.statSync(projectPath).isDirectory()) continue;
      if (!fs.existsSync(dbPath)) continue;
      const stat = fs.statSync(dbPath);
      if (stat.size === 0) continue; // Skip empty placeholder files
      discovered.push({ name: dir, path: projectPath, dbPath });
    } catch { continue; }
  }
  return discovered;
}

module.exports = { discoverProjects, DEFAULT_WORKSPACE };
```

Then update the 3 consumers to import from this module instead of maintaining their own copies. This is a refactor — behavior stays the same.

#### 2. Fix `precompact-save.sh`

Replace hardcoded for-loop (lines 50-53) with dynamic discovery:

```bash
# Replace hardcoded list with dynamic discovery
PROJECT_DBS=$(node -e "
  const { discoverProjects } = require('$BASE/xpollination-mcp-server/viz/discover-projects.cjs');
  discoverProjects().forEach(p => console.log(p.dbPath));
")
for project_db in $PROJECT_DBS; do
```

#### 3. Fix `guessProject()` in interface-cli.js

Replace hardcoded if-chain (lines 252-258) with dynamic extraction:

```javascript
function guessProject(dbPath) {
  if (!dbPath) return 'unknown';
  // Extract project name from path: .../ProjectName/data/xpollination.db
  const match = dbPath.match(/([^/]+)\/data\/xpollination\.db$/);
  return match ? match[1] : 'unknown';
}
```

This works for any project — no hardcoded names needed.

#### 4. Update SKILL.md Documentation

Replace the hardcoded 3-project list (lines 166-169) with:

```
**Project databases** are auto-discovered from the workspace path.
The `--wait` output includes the project name and DB path for each task.
Use those values directly — no hardcoded list needed.

Default workspace: `$XPO_WORKSPACE_PATH` or `/home/developer/workspaces/github/PichlerThomas/`
```

#### 5. Ghost Project Decision (Documentation Only)

Flag for Thomas:
- `xpollination-hive` (616K) — legacy repo, has stale data. Thomas decides: keep or delete.
- `xpollination-best-practices` (28K) — now has real data, valid project.

No code change needed — the >0 bytes filter in `discoverProjects()` handles empty DBs.

### Changes Required

1. **`viz/discover-projects.cjs`** (CREATE, ~25 lines):
   - Shared discovery module

2. **`viz/server.js`** (EDIT, ~3 lines):
   - Import shared module via `createRequire`, remove local discovery function

3. **`viz/agent-monitor.cjs`** (EDIT, ~3 lines):
   - Import shared module, remove local `discoverProjects()`

4. **`viz/pm-status.cjs`** (EDIT, ~3 lines):
   - Import shared module, remove local `discoverDatabases()`

5. **`src/db/interface-cli.js`** (EDIT, ~5 lines):
   - Replace `guessProject()` with regex-based path extraction

6. **`xpollination-best-practices/scripts/xpo.claude.precompact-save.sh`** (EDIT, ~4 lines):
   - Replace hardcoded for-loop with `node -e` discovery call

7. **`xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`** (EDIT, ~4 lines):
   - Replace hardcoded DB list with auto-discovery note

### What This Does NOT Do

- Does NOT change discovery behavior (same scan logic, just deduplicated)
- Does NOT delete ghost projects (Thomas decides)
- Does NOT add new UI elements
- Does NOT change the `XPO_WORKSPACE_PATH` env var pattern (already established)
- Does NOT affect versioned viz copies (discovery is at root level)

### Acceptance Criteria (v0.0.2)

1. `viz/discover-projects.cjs` exists as single source of truth
2. `server.js`, `agent-monitor.cjs`, `pm-status.cjs` all import from shared module
3. `precompact-save.sh` discovers projects dynamically
4. `guessProject()` works for any project name (no hardcoded if-chain)
5. SKILL.md documents auto-discovery instead of hardcoded list
6. All existing behavior preserved (same projects discovered, same filtering)
7. `XPO_WORKSPACE_PATH` remains the single config point

## DO

Implementation by DEV agent. 1 new file + 6 edits. ~50 lines changed total.

## STUDY

After implementation:
- Set `XPO_WORKSPACE_PATH` to a test dir, verify only projects in that dir are discovered
- Unset env var, verify default path works
- Add a new project dir with `data/xpollination.db`, verify it appears in discovery
- Run `pm-status.cjs`, `agent-monitor.cjs`, verify both work

## ACT

If approved: document the `XPO_WORKSPACE_PATH` env var in project README. Flag ghost project decision to Thomas.
