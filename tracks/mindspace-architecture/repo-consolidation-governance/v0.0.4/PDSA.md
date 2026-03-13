# PDSA: Repo Consolidation — Governance, Rename, Script Migration, Archive (v0.0.4)

**Task:** `repo-consolidation-governance`
**Version:** v0.0.4
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.3 (scope drift — hive infrastructure leaked into governance task)

---

## PLAN

### Rework Context

v0.0.2 and v0.0.3 added hive infrastructure (DNS, nginx, HTTPS, per-agent API keys, rate limiting) that does not belong in this task. Thomas directive: return to root intent. This task is D1-D7 only — governance repo, GitHub renames, script migration, archival. All hive work is owned by `agent-continuity-recovery`.

v0.0.1 had the correct scope. This version refines v0.0.1 with cleaner execution steps.

### Current State

**GitHub repos under XPollination org:**

| Repo | Visibility | Status |
|------|-----------|--------|
| `xpollination-mcp-server` | Public | Active — primary product repo |
| `xpollination-best-practices` | Private | Content absorbed into mcp-server |
| `xpollination-mindspace` | Public | Active — mindmap viz (name needed for rename) |
| `xpollination-hive` | Public | Stale — duplicate of brain API |
| `HomePage` | Private | Active — website |
| `ProfileAssistant` | Private | Active — profile management |

### Design Decisions

**D1: Create XPollinationGovernance repo.**

Private repo under XPollination org:

```
XPollinationGovernance/
├── CLAUDE.md
├── README.md
├── decisions/
│   └── 2026-03-13-repo-consolidation.md
└── inventory/
    └── projects.md
```

ADR content:

```markdown
# ADR: Repo Consolidation (2026-03-13)

## Status: Accepted

## Context
7 repos under XPollination org. Multiple stale/duplicate repos.
Code consolidation complete (mindspace-docker-installer v0.0.3 absorbed best-practices).
Organizational cleanup remains.

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

Project inventory:

```markdown
# XPollination Project Inventory

| Repo | Visibility | Status | Purpose |
|------|-----------|--------|---------|-
| xpollination-mindspace | Public | Active | Primary product — Mindspace PM system |
| XPollinationGovernance | Private | Active | Cross-project governance, ADRs |
| HomePage | Private | Active | xpollination.earth website |
| ProfileAssistant | Private | Active | Profile management |
| xpollination-mindspace-legacy | Public | Archived | Former mindmap viz |
| xpollination-best-practices | Private | Archived | Absorbed into mindspace |
| xpollination-hive | Private | Archived | Stale brain API copy |
```

**D2: Rename sequence — order matters.**

GitHub rename is atomic and creates auto-redirects. Two repos cannot share a name simultaneously.

```bash
# Step 1: Free the "mindspace" name
gh repo rename xpollination-mindspace-legacy -R XPollination/xpollination-mindspace

# Step 2: Archive legacy
gh repo archive -R XPollination/xpollination-mindspace-legacy

# Step 3: Claim the "mindspace" name
gh repo rename xpollination-mindspace -R XPollination/xpollination-mcp-server

# Step 4: Ensure public
gh repo edit -R XPollination/xpollination-mindspace --visibility public

# Step 5: Archive best-practices
gh repo archive -R XPollination/xpollination-best-practices

# Step 6: Make hive private
gh repo edit -R XPollination/xpollination-hive --visibility private

# Step 7: Archive hive
gh repo archive -R XPollination/xpollination-hive
```

After step 3, update local remote:

```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
git remote set-url origin git@github.com:XPollination/xpollination-mindspace.git
```

The develop worktree (`xpollination-mcp-server-test`) shares the same `.git` — one `set-url` suffices.

**D3: Script migration.**

| Script | From | To |
|--------|------|----|-
| `claude-session.sh` | `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/` | `xpollination-mcp-server/scripts/` |
| `claude-unblock.sh` | Same directory | `xpollination-mcp-server/scripts/` |

Changes in `claude-session.sh`:
- `SELF_PATH` → use `$(realpath "$0")` for auto-detection
- Line 195: skills source `xpollination-best-practices/.claude/skills` → `xpollination-mcp-server/.claude/skills`
- Line 197: settings template path → `xpollination-mcp-server/scripts/xpo.claude.settings.json`
- Line 198: sync script path → `xpollination-mcp-server/scripts/xpo.claude.sync-settings.js`

Changes in `claude-unblock.sh`:
- `SELF_PATH` → use `$(realpath "$0")`

**D4: Remove scripts from HomeAssistant.**

After copying to xpollination-mcp-server and verifying:
1. Delete `claude-session.sh` from HomeAssistant
2. Delete `claude-unblock.sh` from HomeAssistant
3. Update symlinks:

```bash
# Check existing symlinks
ls -la /usr/local/bin/claude-session 2>/dev/null
ls -la ~/bin/claude-session 2>/dev/null
which claude-session 2>/dev/null

# Update to new location
ln -sfn /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/scripts/claude-session.sh ~/bin/claude-session
```

**D5: CLAUDE.md updates.**

`~/.claude/CLAUDE.md` references to update:
- Conceptual name: "xpollination-mcp-server (content pipeline + PM tool)" → "xpollination-mindspace (Mindspace PM system)"
- Skills source path: `xpollination-best-practices/.claude/skills/` → `xpollination-mcp-server/.claude/skills/`
- Leave filesystem paths as-is (local dir not renamed)

**D6: Brain evolution thought.**

After all renames/archives complete:

```
EVOLUTION: xpollination-mcp-server renamed to xpollination-mindspace on GitHub.
Best-practices, hive, and old mindspace archived.
One primary product repo. Governance in XPollinationGovernance.
Scripts migrated from HomeAssistant to xpollination-mcp-server/scripts/.
```

**D7: No hive infrastructure in this task.**

DNS, nginx, HTTPS, per-agent API keys, rate limiting — all owned by `agent-continuity-recovery`. This task does only organizational cleanup.

### Execution Order (10 steps)

1. **Create governance repo** — `gh repo create XPollination/XPollinationGovernance --private`
2. **Populate governance repo** — CLAUDE.md, README, ADR, inventory
3. **Copy scripts** from HomeAssistant → xpollination-mcp-server/scripts/
4. **Update script paths** — SELF_PATH, skills source, settings template, sync script
5. **Verify scripts work** from new location
6. **Execute rename sequence** — 7 `gh` commands in order (D2)
7. **Update local git remote URL** — `origin` → `xpollination-mindspace.git`
8. **Update CLAUDE.md** — repo name references
9. **Delete old scripts from HomeAssistant** + update symlinks
10. **Brain evolution thought** — document consolidation

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `XPollinationGovernance/` (new repo) | **CREATE** | Governance repo |
| `XPollinationGovernance/CLAUDE.md` | **CREATE** | Repo instructions |
| `XPollinationGovernance/README.md` | **CREATE** | Purpose description |
| `XPollinationGovernance/decisions/2026-03-13-repo-consolidation.md` | **CREATE** | ADR |
| `XPollinationGovernance/inventory/projects.md` | **CREATE** | Project state table |
| `scripts/claude-session.sh` | **COPY+MODIFY** | From HomeAssistant, update paths |
| `scripts/claude-unblock.sh` | **COPY+MODIFY** | From HomeAssistant, update paths |
| `~/.claude/CLAUDE.md` | **MODIFY** | Update repo name references |

### Risks and Mitigations

**R1: Rename breaks active agent sessions.** GitHub auto-redirects handle remote URL. Local clones have old remote. Mitigation: `git remote set-url` immediately after rename. Active tmux sessions work on filesystem paths, unaffected.

**R2: Skills symlinks break after script migration.** `sync_skills()` creates symlinks from source. If source path changes (best-practices → mcp-server), old symlinks break on next session creation. Mitigation: `sync_skills()` runs on every session creation — new sessions auto-fix.

**R3: GitHub API rate limits.** Multiple `gh` commands in sequence. Mitigation: Sequential execution, not parallel.

**R4: Local directory name mismatch.** GitHub renamed to `xpollination-mindspace` but local dir stays `xpollination-mcp-server`. This is expected — GitHub rename changes the remote only. CLAUDE.md uses local paths. Future task may rename local directory.

**R5: systemd services reference old paths.** `mindspace.service` uses filesystem paths to `xpollination-mcp-server`. These don't change — local directory isn't renamed.

### Verification Plan

1. `gh repo view XPollination/XPollinationGovernance` — governance repo exists
2. `cat` ADR and inventory files — content correct
3. `ls scripts/claude-session.sh scripts/claude-unblock.sh` — scripts present
4. `grep -c "xpollination-best-practices" scripts/claude-session.sh` — should be 0
5. `gh repo view XPollination/xpollination-mindspace` — renamed repo exists
6. `gh repo view XPollination/xpollination-mindspace-legacy --json isArchived` — true
7. `gh repo view XPollination/xpollination-best-practices --json isArchived` — true
8. `gh repo view XPollination/xpollination-hive --json visibility,isArchived` — private + true
9. `git remote -v` — points to `xpollination-mindspace.git`
10. `grep "xpollination-mindspace" ~/.claude/CLAUDE.md` — updated references
11. Old HomeAssistant scripts deleted
12. Symlinks point to new location

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
