# PDSA: Repo Consolidation — Governance, Rename, Script Migration, Archive

**Task:** `repo-consolidation-governance`
**Version:** v0.0.1
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Thomas made 7 decisions (D1–D7) on 2026-03-13 about repo consolidation. The code consolidation is done (`mindspace-docker-installer` v0.0.3 absorbed best-practices content). What remains is organizational: governance repo creation, repo renames, script migration, archival, and reference updates.

### Current State

**GitHub repos under XPollination org:**

| Repo | Visibility | Status |
|------|-----------|--------|
| `xpollination-mcp-server` | Public | Active — primary product repo |
| `xpollination-best-practices` | Private | Content absorbed into mcp-server |
| `xpollination-mindspace` | Public | Active — mindmap viz (name needed for rename) |
| `xpollination-hive` | Public | Stale — duplicate of brain API |
| `HomePage` | Private | Active — website |

**Scripts in wrong repo:**
- `claude-session.sh` — in `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/`
  - Has `SELF_PATH` pointing to HomeAssistant location
  - References `xpollination-best-practices` for skills source (line 195), settings template (line 197), sync script (line 198)
- `claude-unblock.sh` — same HomeAssistant directory
  - Has `SELF_PATH` pointing to HomeAssistant location

**CLAUDE.md references to update:**
- `~/.claude/CLAUDE.md` references `xpollination-mcp-server` (lines 5, 36-37, 234, 238) and `xpollination-best-practices` (lines 59-60)

### Design Decisions

**D1: Create XPollinationGovernance repo.**

Private repo under XPollination org. Contains:
```
XPollinationGovernance/
├── CLAUDE.md          # Repo-level instructions for agents
├── README.md          # Purpose: cross-project governance
├── decisions/
│   └── 2026-03-13-repo-consolidation.md   # ADR format
└── inventory/
    └── projects.md    # Current state table
```

ADR format (Architecture Decision Record):
```markdown
# ADR: Repo Consolidation (2026-03-13)

## Status: Accepted

## Context
7 repos under XPollination org. Multiple stale/duplicate repos...

## Decisions
D1: xpollination-best-practices → ARCHIVE
D2: xpollination-hive → PRIVATE + ARCHIVE
D3: xpollination-mindspace → rename to xpollination-mindspace-legacy + ARCHIVE
D4: xpollination-mcp-server → rename to xpollination-mindspace (PUBLIC)
D5: HomeAssistant → no change
D6: HomePage → no change
D7: ProfileAssistant → no change

## Consequences
- Single primary product repo: xpollination-mindspace
- GitHub auto-redirects preserve all existing URLs
- Governance is cross-project, lives in its own repo
```

Project inventory format:
```markdown
# XPollination Project Inventory

| Repo | Visibility | Status | Purpose |
|------|-----------|--------|---------|
| xpollination-mindspace | Public | Active | Primary product — Mindspace PM system |
| XPollinationGovernance | Private | Active | Cross-project governance, ADRs |
| HomePage | Private | Active | xpollination.earth website |
| ProfileAssistant | Private | Active | Profile management |
| xpollination-mindspace-legacy | Public | Archived | Former mindmap viz |
| xpollination-best-practices | Private | Archived | Absorbed into mindspace |
| xpollination-hive | Private | Archived | Stale brain API copy |
```

**D2: Rename sequence — order matters.**

GitHub rename is atomic (no downtime) and creates auto-redirects. But two repos can't have the same name simultaneously.

Sequence:
1. `gh repo rename xpollination-mindspace-legacy -R XPollination/xpollination-mindspace` — frees the name
2. `gh repo archive -R XPollination/xpollination-mindspace-legacy` — archive legacy
3. `gh repo rename xpollination-mindspace -R XPollination/xpollination-mcp-server` — claim the name
4. `gh repo edit -R XPollination/xpollination-mindspace --visibility public` — ensure public (already is)
5. `gh repo archive -R XPollination/xpollination-best-practices` — archive
6. `gh repo edit -R XPollination/xpollination-hive --visibility private` — make private
7. `gh repo archive -R XPollination/xpollination-hive` — archive

**Critical:** After step 3, the local clone's remote URL must be updated:
```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
git remote set-url origin git@github.com:XPollination/xpollination-mindspace.git
```

The develop worktree (`xpollination-mcp-server-test`) shares the same `.git` — only one `set-url` needed.

**D3: Script migration — move to xpollination-mcp-server/scripts/.**

| Script | From | To | Changes |
|--------|------|----|---------|
| `claude-session.sh` | `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/` | `xpollination-mcp-server/scripts/` | Update SELF_PATH. Update skills source from `xpollination-best-practices` to local `.claude/skills/`. Update settings template path. |
| `claude-unblock.sh` | Same HomeAssistant dir | `xpollination-mcp-server/scripts/` | Update SELF_PATH. |

**SELF_PATH updates:**
- `claude-session.sh` line 67: `SELF_PATH` → `$WORKING_DIR/xpollination-mcp-server/scripts/claude-session.sh` (pre-rename) or use `$(realpath "$0")` for auto-detection
- `claude-unblock.sh` line 50: same pattern

**Skills source update in claude-session.sh:**
- Line 195: `$WORKING_DIR/xpollination-best-practices/.claude/skills` → `$WORKING_DIR/xpollination-mcp-server/.claude/skills`
- Line 197: `$WORKING_DIR/xpollination-best-practices/scripts/xpo.claude.settings.json` → `$WORKING_DIR/xpollination-mcp-server/scripts/xpo.claude.settings.json`
- Line 198: `$WORKING_DIR/xpollination-best-practices/scripts/xpo.claude.sync-settings.js` → `$WORKING_DIR/xpollination-mcp-server/scripts/xpo.claude.sync-settings.js`

After the rename (D2 step 3), the directory name on disk remains `xpollination-mcp-server` — the GitHub name changes but the local directory doesn't auto-rename. Thomas may choose to rename the directory later, but that's out of scope for this task.

**D4: Remove scripts from HomeAssistant repo.**

After copying to xpollination-mcp-server and verifying they work:
1. Delete `claude-session.sh` from HomeAssistant
2. Delete `claude-unblock.sh` from HomeAssistant
3. Update any symlinks on Hetzner that pointed to HomeAssistant locations

Check for symlinks:
```bash
ls -la /usr/local/bin/claude-session 2>/dev/null
ls -la ~/bin/claude-session 2>/dev/null
which claude-session 2>/dev/null
```

**D5: CLAUDE.md updates.**

`~/.claude/CLAUDE.md` needs these reference updates:
- Line 5: `xpollination-mcp-server` → `xpollination-mindspace` (in projects description)
- Lines 36-37: Port/env table references
- Lines 59-60: Skills source path: `xpollination-best-practices/.claude/skills/` → `xpollination-mcp-server/.claude/skills/` (or `xpollination-mindspace/.claude/skills/` after rename)
- Line 191: Cross-repo PDSA references
- Line 234, 238: Monitor script locations

Note: The rename applies to the GitHub repo name, not necessarily the local directory path. CLAUDE.md references use local filesystem paths, so they may not change unless Thomas also renames the local directory. The PDSA should update the conceptual name references (e.g., "xpollination-mcp-server (content pipeline + PM tool)" → "xpollination-mindspace (Mindspace PM system)") but leave filesystem paths as-is until/unless the local directory is renamed.

**D6: Brain evolution thought.**

After all renames/archives are complete, contribute one thought documenting the consolidation:
```
EVOLUTION: xpollination-mcp-server renamed to xpollination-mindspace.
Best-practices, hive, and old mindspace archived.
One primary product repo. Governance in XPollinationGovernance.
```

**D7: Symlink updates on Hetzner.**

The `claude-session` launcher is likely referenced by PATH or symlink. After moving the script, update:
```bash
# If symlink exists:
ln -sfn /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/scripts/claude-session.sh /usr/local/bin/claude-session
# Or for developer user (no sudo):
ln -sfn /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/scripts/claude-session.sh ~/bin/claude-session
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `XPollinationGovernance/` (new repo) | **CREATE** | Governance repo with CLAUDE.md, README |
| `XPollinationGovernance/decisions/2026-03-13-repo-consolidation.md` | **CREATE** | ADR documenting D1-D7 |
| `XPollinationGovernance/inventory/projects.md` | **CREATE** | Project state table |
| `scripts/claude-session.sh` | **COPY+MODIFY** | From HomeAssistant, update paths |
| `scripts/claude-unblock.sh` | **COPY+MODIFY** | From HomeAssistant, update paths |
| `~/.claude/CLAUDE.md` | **MODIFY** | Update repo name references |

### Execution Order (Critical)

This is a multi-step process with dependencies. DEV must execute in this exact order:

1. **Create governance repo** — no dependencies
2. **Copy scripts** from HomeAssistant to xpollination-mcp-server/scripts/, update paths
3. **Verify scripts work** — run `claude-session` from new location
4. **Execute rename sequence** (D2) — must be ordered as specified
5. **Update local git remote URL** — after rename
6. **Update CLAUDE.md** — after rename
7. **Delete old scripts from HomeAssistant** — after verified working
8. **Update symlinks** — after scripts verified at new location
9. **Archive repos** — last step
10. **Contribute brain evolution thought** — after everything is done

### Risks and Mitigations

**R1: Rename breaks active agent sessions.** GitHub auto-redirects handle remote URL, but local clones have old remote. Mitigation: `git remote set-url` immediately after rename. Active tmux sessions continue working (they use filesystem paths, not GitHub URLs).

**R2: Skills symlinks break after script migration.** `claude-session.sh` sync_skills() creates symlinks from `~/.claude/skills/` to source. If source path changes (best-practices → mcp-server), old symlinks break on next session creation. Mitigation: sync_skills() runs on every session creation — new sessions get correct symlinks automatically.

**R3: GitHub API rate limits.** Multiple `gh` commands in sequence. Mitigation: Sequential execution with small delays, not parallel.

**R4: Local directory name mismatch after rename.** GitHub repo renamed to `xpollination-mindspace` but local dir remains `xpollination-mcp-server`. This is expected — GitHub rename is for the remote only. CLAUDE.md paths use local directory names. Future task may rename local directory.

**R5: systemd services reference old paths.** `mindspace.service` and `mindspace-test.service` use filesystem paths that reference `xpollination-mcp-server`. These don't change since the local directory isn't renamed.

### Verification Plan

1. `gh repo view XPollination/XPollinationGovernance` — governance repo exists
2. `cat XPollinationGovernance/decisions/2026-03-13-repo-consolidation.md` — ADR present
3. `cat XPollinationGovernance/inventory/projects.md` — inventory present
4. `ls scripts/claude-session.sh scripts/claude-unblock.sh` — scripts present
5. `grep -c "xpollination-best-practices" scripts/claude-session.sh` — should be 0 (no old references)
6. `gh repo view XPollination/xpollination-mindspace` — renamed repo exists
7. `gh repo view XPollination/xpollination-mindspace-legacy --json isArchived` — archived
8. `gh repo view XPollination/xpollination-best-practices --json isArchived` — archived
9. `gh repo view XPollination/xpollination-hive --json visibility,isArchived` — private + archived
10. `git remote -v` — points to `XPollination/xpollination-mindspace.git`
11. `grep "xpollination-mindspace" ~/.claude/CLAUDE.md` — updated references
12. Scripts from HomeAssistant deleted: `ls HomeAssistant/.../claude-session.sh` — not found

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
