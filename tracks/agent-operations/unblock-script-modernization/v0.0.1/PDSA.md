# PDSA: Modernize claude-unblock — Auto-detect All Agents + Remove Legacy Skill (v0.0.1)

**Task:** `unblock-script-modernization`
**Version:** v0.0.1
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

`claude-unblock.sh` has three hardcoded modes:
- `agents` — monitors panes 1-3 (PDSA, DEV, QA) of `claude-agents` session
- `liaison` — monitors pane 0 of `claude-agents` session
- Named session — monitors pane 0 of any named session

This design excludes agents by default (liaison was excluded because it prompted during human decisions — that bug was fixed 2026-03-13 with the bullet gate). Each new tmux session (e.g., `HomeAssistantDevOpsAgent`) requires a separate `claude-unblock <name>` invocation. With growing agent count, this doesn't scale.

Additionally, `~/.claude/skills/xpo.claude.unblock/SKILL.md` is a legacy bootstrapping skill that agents still reference. It injects inline bash monitoring loops into agent context, wasting context window and conflicting with the proper shell script.

### Current Architecture (to preserve)

The shell script has battle-tested safety mechanisms that MUST be preserved:

1. **Bullet gate (●)** — distinguishes tool permission prompts from `AskUserQuestion` prompts. Lines 179-184.
2. **Prompt area isolation** — uses `tail -40` for option matching to avoid stale scrollback false positives. Line 165.
3. **"Don't ask again" preference** — prefers permanent allow over session allow. Lines 187-200.
4. **tmux session runner** — runs in its own tmux session (`claude-unblock-*`) for persistence across disconnects. Lines 287-307.
5. **Single-digit option guard** — only matches options 1-9, ignoring line numbers from tool output. Line 192.
6. **3-second cooldown** — prevents rapid re-confirmation of the same prompt.
7. **Remote SSH support** — can run from local machine, SSHes to Hetzner.

### Design Decisions

**D1: Auto-detect all Claude agents via tmux.**

Replace hardcoded `PANES` with dynamic discovery:

```bash
# Find all panes running 'claude' across ALL tmux sessions
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command} #{pane_title}' \
  | grep 'claude'
```

This finds every pane where `pane_current_command` is `claude`, regardless of session name or pane layout.

**D2: Derive agent name from context.**

For each detected pane, derive a human-readable name:

1. If session is `claude-agents`, use pane index mapping: 0=LIAISON, 1=PDSA, 2=DEV, 3=QA
2. Otherwise, use session name as the agent name (e.g., `HomeAssistantDevOpsAgent`)

```bash
get_agent_name() {
    local session="$1" pane_idx="$2"
    if [[ "$session" == *"claude-agents"* ]]; then
        case "$pane_idx" in
            0) echo "LIAISON" ;;
            1) echo "PDSA" ;;
            2) echo "DEV" ;;
            3) echo "QA" ;;
            *) echo "${session}:${pane_idx}" ;;
        esac
    else
        echo "$session"
    fi
}
```

**D3: Optional target filter.**

```
claude-unblock              # All detected agents (default)
claude-unblock liaison      # Only panes matching "liaison" name
claude-unblock dev qa       # Multiple specific targets
```

Matching is case-insensitive against the derived agent name. If no targets match, show error with discovered agents.

**D4: Show discovery output on startup.**

```
=== claude-unblock: auto-discovery ===
Found 5 Claude agents:
  claude-agents:0.0  LIAISON   ✓ online
  claude-agents:0.1  PDSA      ✓ online
  claude-agents:0.2  DEV       ✓ online
  claude-agents:0.3  QA        ✓ online
  HomeAssistantDevOpsAgent:0.0  HomeAssistantDevOpsAgent  ✓ online
Monitoring: ALL (5 agents)
Poll interval: 6s
```

When filtering:
```
Monitoring: LIAISON, DEV (2 of 5 agents)
```

**D5: Re-discover periodically.**

Agents may start/stop during the unblock session. Re-run discovery every 60 seconds (every ~10 poll cycles). Add new agents, remove dead ones. Log changes:

```
[12:05:30] + NewAgent detected (tmux-session:0.0)
[12:10:00] - HomeAssistantDevOpsAgent removed (pane gone)
```

**D6: Remove legacy skill.**

Delete these files/symlinks:
- `~/.claude/skills/xpo.claude.unblock/SKILL.md`
- `~/.claude/skills/xpo.claude.unblock/` (directory)
- `xpollination-best-practices/.claude/skills/xpo.claude.unblock/SKILL.md` (source)
- `xpollination-best-practices/.claude/skills/xpo.claude.unblock/` (directory)

Update references:
- `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` — remove `xpo.claude.unblock` from install instructions
- `xpollination-mcp-server/.claude/skills/xpo.claude.monitor/SKILL.md` — same (if symlinked, same file)
- `xpollination-best-practices/tracks/agent-operations/skill-deployment/v0.0.1/pdsa/2026-02-27-skill-hook-auto-deploy.pdsa.md` — leave as historical reference (don't modify PDSAs)

Note: `xpollination-best-practices` is now archived. DEV should unarchive temporarily, make changes, re-archive. Or if the symlink from `~/.claude/skills/xpo.claude.unblock` points to best-practices, just delete the symlink and local directory.

**D7: Keep tmux session runner pattern.**

The `claude-unblock-*` tmux session pattern is proven reliable. Keep it. The session name becomes `claude-unblock` (singular, no mode suffix needed since it monitors everything).

If old-style sessions exist (`claude-unblock-liaison`, `claude-unblock-HomeAssistantDevOpsAgent`), the startup should detect and offer to kill them, since the new unified session replaces them all.

**D8: Backward compatibility.**

`claude-unblock agents` and `claude-unblock liaison` still work — they're treated as target filters (matching agent names). Named session mode (`claude-unblock HomeAssistantDevOpsAgent`) also works — filters to that name.

The only behavioral change: the script always discovers ALL agents first, then filters.

### Execution Steps

1. **Modify `scripts/claude-unblock.sh`:**
   - Add `discover_agents()` function using `tmux list-panes -a`
   - Add `get_agent_name()` function
   - Replace hardcoded `PANES` array with dynamic `AGENTS` associative array
   - Add re-discovery every ~60s in the main loop
   - Add startup display of all discovered agents
   - Handle target filtering via command-line args
   - Kill old-style separate sessions on startup

2. **Remove legacy skill:**
   - `rm -rf ~/.claude/skills/xpo.claude.unblock/`
   - Remove from install loop in monitor SKILL.md

3. **Update CLAUDE.md** (if any reference to skill remains)

### Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/claude-unblock.sh` | **MODIFY** | Auto-discovery, dynamic PANES, re-discovery |
| `~/.claude/skills/xpo.claude.unblock/` | **DELETE** | Remove legacy skill |
| `.claude/skills/xpo.claude.monitor/SKILL.md` | **MODIFY** | Remove unblock skill from install instructions |

### Verification Plan

1. `claude-unblock` discovers all 5 agents (4 in claude-agents + 1 HomeAssistantDevOpsAgent)
2. `claude-unblock liaison` filters to 1 agent
3. `claude-unblock dev qa` filters to 2 agents
4. Re-discovery adds newly started agents within 60s
5. Permission prompts are still confirmed correctly (bullet gate preserved)
6. AskUserQuestion prompts are NOT auto-confirmed (bullet gate preserved)
7. `ls ~/.claude/skills/xpo.claude.unblock/` returns "No such file or directory"
8. `grep -r "xpo.claude.unblock" ~/.claude/skills/xpo.claude.monitor/` returns no install references

### Risks

**R1: Breaking active unblock sessions.** Old `claude-unblock-*` sessions may be running. Mitigation: new script detects and offers to replace them.

**R2: tmux list-panes timing.** Agents starting mid-cycle won't be found until next re-discovery. Mitigation: 60s re-discovery interval is acceptable.

**R3: best-practices is archived.** Cannot push changes. Mitigation: Delete local symlink and directory. The source in archived repo is irrelevant — sync_skills only creates symlinks from source to `~/.claude/skills/`, and the source will be the mcp-server (now mindspace) repo going forward.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
