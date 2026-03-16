# PDSA: claude-unblock.sh — Exclude Human Pane from Auto-Confirm

**Task:** `ms-unblock-human-pane-exclusion`
**Priority:** Critical
**Status:** Design

## Problem

`claude-unblock.sh` in "agents" mode monitors ALL panes 0-3 (LIAISON, PDSA, DEV, QA). Pane 0 is Thomas's human interaction pane. When the script detects what it thinks is a permission prompt in pane 0, it sends keystrokes (`1`, `2`, `3`, or `Enter`) — corrupting Thomas's active input. This happened twice in one session, forcing `Ctrl+C` recovery.

**Root cause:** Line 107 in `scripts/claude-unblock.sh`:
```bash
PANES=([0]="LIAISON" [1]="PDSA" [2]="DEV" [3]="QA")
```
No distinction between "human pane" and "agent pane" — all are monitored equally.

## Design Decisions

### D1: Default "agents" mode excludes pane 0

Change the default `agents` mode PANES from `[0]=LIAISON [1]=PDSA [2]=DEV [3]=QA` to `[1]=PDSA [2]=DEV [3]=QA`.

**Rationale:** In the standard 4-agent tmux layout (`claude-agents`), pane 0 is LIAISON — the pane where Thomas types. Auto-confirming here is always wrong. The "liaison" mode already exists as an explicit opt-in for when pane 0 has a Claude agent.

**Change:** Line 107 in `scripts/claude-unblock.sh`:
```bash
# Before:
PANES=([0]="LIAISON" [1]="PDSA" [2]="DEV" [3]="QA")

# After:
PANES=([1]="PDSA" [2]="DEV" [3]="QA")
```

### D2: Update startup banner to reflect exclusion

Line 108 message should change from:
```
=== claude-unblock: ALL PANES mode (panes 0-3: LIAISON, PDSA, DEV, QA) ===
```
to:
```
=== claude-unblock: AGENT PANES mode (panes 1-3: PDSA, DEV, QA) ===
```

### D3: Add "all" mode for full-pane monitoring

For cases where pane 0 also has a Claude agent (no human present), add an explicit `all` mode:
```bash
elif [[ "$mode" == "all" ]]; then
    PANES=([0]="LIAISON" [1]="PDSA" [2]="DEV" [3]="QA")
    echo "=== claude-unblock: ALL PANES mode (panes 0-3, including human pane) ==="
```

**Usage:** `claude-unblock all` — only when Thomas is NOT using pane 0.

### D4: Update header comments

Lines 10, 27 in the header comment block need updating:
- Line 10: `claude-unblock` → monitors panes 1-3 (agent panes only)
- Line 27: `agents (default) → claude-agents session, panes 1-3 (PDSA, DEV, QA)`
- Add: `all → claude-agents session, panes 0-3 (ALL including LIAISON)`

### D5: Update help text

Line 277 in the `--help` output should reflect the new default behavior and add the `all` option.

## Acceptance Criteria

1. `claude-unblock` (default "agents" mode) monitors only panes 1-3, NOT pane 0
2. `claude-unblock all` monitors all panes 0-3 (explicit opt-in)
3. `claude-unblock liaison` still monitors only pane 0 (unchanged)
4. Startup banner shows correct pane range
5. Help text documents all three modes
6. Header comments updated

## Test Plan

1. Run `claude-unblock --run-agents` → verify PANES does NOT include key 0
2. Run `claude-unblock --run-all` → verify PANES includes keys 0-3
3. Run `claude-unblock --run-liaison` → verify PANES includes only key 0
4. With Thomas active in pane 0: confirm no keystrokes sent to pane 0 in agents mode
5. Verify help text shows `all` mode

## Risk Assessment

- **Low risk:** Change is additive (new `all` mode) and restrictive (removes pane 0 from default)
- **No breaking change:** Anyone using `claude-unblock` today gets safer behavior
- **Explicit opt-in:** `claude-unblock all` requires deliberate choice to include human pane
