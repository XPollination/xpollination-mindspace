# PDSA: Zero-Knowledge Agent Setup

**Date:** 2026-02-06
**Task:** zero-knowledge-agent-setup
**Status:** Iteration 1
**Depends on:** security-agent-role-verification (key validation in interface-cli.js)

---

## PLAN

### Problem Statement
Starting the multi-agent system requires manual steps: creating tmux panes, starting Claude in each, sending role prompts, starting monitors. Goal: one script does everything.

### Vision
```
git clone repo && cd repo && ./start-agents.sh → all agents running, registered, monitoring
```

### Current State
- `claude-session.sh` exists in HomeAssistant repo (3-pane layout: orchestrator, pdsa+qa, dev)
- Role prompts sent via `tmux send-keys` after Claude starts
- No auto-registration, no auto-monitoring
- 3 roles (orchestrator, pdsa+qa, dev) — needs update to 4 roles per WORKFLOW.md v9

### Research Findings

**Claude CLI supports:**
- `--append-system-prompt <prompt>` — inject role identity at startup
- Interactive mode by default (no `--print` flag needed)
- Trust prompt handled by existing `handle_trust_prompt()` function

**Key design decision:** Use `--append-system-prompt` to set the role, then the agent's first action (via instructions) is to self-register and start monitoring. This is cleaner than `send-keys` which is fragile.

---

## DO

### 1. Script: `start-agents.sh`

**Location:** `xpollination-mcp-server/start-agents.sh` (repo root, executable)

**Layout (4 panes):**
```
+------------------+------------------+------------------+
|                  |                  |   DEV            |
|  LIAISON         |  PDSA            |   (right-top)    |
|  (left)          |  (middle)        +------------------+
|                  |                  |   QA             |
|                  |                  |   (right-bottom) |
+------------------+------------------+------------------+
  Pane 0             Pane 1             Pane 2 / Pane 3
```

**Script flow:**
```bash
#!/bin/bash
set -euo pipefail

SESSION="claude-agents"
CLAUDE_BIN="/home/developer/.local/bin/claude"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session (pane 0: LIAISON)
tmux new-session -d -s "$SESSION" -c "$REPO_DIR"

# Split: pane 1 (PDSA) to the right of pane 0
tmux split-window -t "${SESSION}:0.0" -h -c "$REPO_DIR"

# Split: pane 2 (DEV) to the right of pane 1
tmux split-window -t "${SESSION}:0.1" -h -c "$REPO_DIR"

# Split pane 2 vertically: pane 3 (QA) below DEV
tmux split-window -t "${SESSION}:0.2" -v -c "$REPO_DIR"

# Even out the 3 columns
tmux select-layout -t "${SESSION}:0" even-horizontal
# Re-split right column (pane 2 is now DEV, pane 3 is QA)

# Start Claude in each pane with role prompt
for role_pane in "liaison:0" "pdsa:1" "dev:2" "qa:3"; do
  role="${role_pane%%:*}"
  pane="${role_pane##*:}"

  tmux send-keys -t "${SESSION}:0.${pane}" \
    "AGENT_ROLE=${role} ${CLAUDE_BIN} --append-system-prompt 'You are the ${role^^} agent. Read ~/.claude/CLAUDE.md for protocols. Your first action: register and start monitoring. Run: source ~/.nvm/nvm.sh && AGENT_KEY=\$(node src/db/register-agent.js ${role}) && export AGENT_KEY && node viz/agent-monitor.cjs ${role}'" \
    Enter
done

# Attach
tmux attach -t "$SESSION"
```

### 2. Agent Startup Sequence

Each agent receives via `--append-system-prompt`:
1. Role identity (e.g., "You are the PDSA agent")
2. Instruction to read CLAUDE.md
3. Registration command: `node src/db/register-agent.js <role>` → returns key
4. Export key: `export AGENT_KEY=<key>`
5. Start monitor: `node viz/agent-monitor.cjs <role>`

Agent's first actions after startup:
```bash
# 1. Register
source ~/.nvm/nvm.sh
AGENT_KEY=$(node src/db/register-agent.js pdsa)
export AGENT_KEY

# 2. Start monitoring (background, then poll)
node viz/agent-monitor.cjs pdsa  # runs in background via tool
```

### 3. New Component: `register-agent.js`

**Location:** `src/db/register-agent.js`

**Behavior:**
```bash
node src/db/register-agent.js pdsa
# stdout: a3f7c9d1  (just the key, for easy capture)
# stderr: Registered role=pdsa key=a3f7c9d1
```

**Internal:**
1. Generate key: `crypto.randomBytes(4).toString('hex')`
2. Load/create `data/agent-keys.json`
3. Store `{key: {role, registered_at, pid}}`
4. Append to `data/agent-audit.log`
5. Print key to stdout (for capture by agent)

### 4. File Changes

| File | Change |
|---|---|
| `start-agents.sh` | NEW — main launch script |
| `src/db/register-agent.js` | NEW — agent self-registration |
| `.gitignore` | ADD `data/agent-keys.json`, `data/agent-audit.log` |
| `CLAUDE.md` | UPDATE — agent startup registration instructions |

### 5. Implementation Subtasks

1. **ST1:** Create `src/db/register-agent.js` (generates key, stores mapping, prints key)
2. **ST2:** Create `start-agents.sh` (tmux layout, Claude startup with role prompts)
3. **ST3:** Add `data/agent-keys.json` and `data/agent-audit.log` to `.gitignore`
4. **ST4:** Update CLAUDE.md with startup registration instructions
5. **ST5:** Write tests for register-agent.js
6. **ST6:** Integration test: script creates correct layout (manual verification)

---

## STUDY

### Why `--append-system-prompt` over `send-keys`?

| Aspect | send-keys (current) | append-system-prompt (proposed) |
|---|---|---|
| Reliability | Fragile (timing, buffer issues) | Built into Claude CLI |
| Role identity | Agent can ignore/forget | Baked into system prompt |
| Complexity | Wait loops, trust prompt handling | Single command |
| Race conditions | Possible (send before ready) | None (prompt set before start) |

### Why separate `register-agent.js` from `interface-cli.js`?

- `interface-cli.js` is for workflow operations (get, list, transition, update-dna)
- Registration is a different concern (identity management)
- Simpler script = easier to test and debug
- Output format differs (register outputs just the key for capture)

### Risks

- **`--append-system-prompt` might not work as expected:** Need to test if it truly appends or overrides. Mitigation: test before implementing.
- **tmux layout after splits:** `even-horizontal` might not produce the right 3-column layout. Mitigation: manual testing, adjust if needed.
- **Agent doesn't execute registration:** Agent might read the prompt but not execute the commands. Mitigation: make registration the explicit first instruction, test with real agents.

---

## ACT

### Acceptance Criteria

- [ ] AC1: `./start-agents.sh` creates 4-pane tmux session (liaison, pdsa, dev, qa)
- [ ] AC2: Each pane starts Claude with correct role via `--append-system-prompt`
- [ ] AC3: `register-agent.js` generates unique key per agent, stores in `data/agent-keys.json`
- [ ] AC4: Agent can capture key and export as `AGENT_KEY`
- [ ] AC5: `data/agent-keys.json` and `data/agent-audit.log` are gitignored
- [ ] AC6: CLAUDE.md documents the startup registration flow
- [ ] AC7: Zero manual steps after running `./start-agents.sh`

### Next Steps
1. Liaison approves this PDSA
2. QA writes tests (TDD) for register-agent.js
3. Dev implements start-agents.sh and register-agent.js
4. Manual integration test: run script, verify all agents register and monitor
