---
name: xpo.claude.monitor
description: Wake up agent, recover from memory, start monitoring
user-invocable: true
allowed-tools: Bash, Read, TaskStop, TaskOutput
---

# XPollination Agent Wake-Up

Wake up, recover context from memory, and start working.

```
/xpo.claude.monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `layer3_enabled` | `true` | Enable Layer 3 gardening on task completion. Set to `false` to skip this step. |

---

## Step 1: Set Identity

Map your role from `$ARGUMENTS`:

| Role | agent_id | agent_name | Pane |
|------|----------|------------|------|
| liaison | `agent-liaison` | `LIAISON` | 0 |
| pdsa | `agent-pdsa` | `PDSA` | 1 |
| dev | `agent-dev` | `DEV` | 2 |
| qa | `agent-qa` | `QA` | 3 |

You ARE this role now. All your work, contributions, and transitions use this identity.

## Step 2: Recover from Memory

The shared memory holds everything you need: your role definition, workflow knowledge, current task state, decisions, and learnings from previous sessions.

**Health check first:**
```bash
BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"
curl -s ${BRAIN_API_URL}/api/v1/health
```

If healthy, generate a session ID and query:

```bash
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
AUTH_HDR="Authorization: Bearer $BRAIN_API_KEY"

# Query 1: Your role and recovery knowledge
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "$AUTH_HDR" \
  -d "{\"prompt\": \"Recovery protocol and role definition for $ARGUMENTS agent. What are my responsibilities and what are the latest operational learnings?\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"read_only\": true}"

# Query 2: Current task state and recent decisions
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "$AUTH_HDR" \
  -d "{\"prompt\": \"Current task state, recent decisions, and in-flight work across all projects\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"read_only\": true}"

# Query 3: In-flight task recovery (transition markers)
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "$AUTH_HDR" \
  -d "{\"prompt\": \"TASK START or TASK BLOCKED markers for $(echo $ARGUMENTS | tr a-z A-Z) agent — any interrupted or in-progress tasks\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"read_only\": true}"
```

**Read the results.** Memory returns `result.sources` (knowledge) and `result.highways_nearby` (most-trafficked paths). Use these to understand your situation.

**If memory is down:** Fall back to `~/.claude/CLAUDE.md` and project CLAUDE.md. Scan PM system directly.

## Step 3: Start Background Monitor

```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

## Step 4: Wait for Work

```bash
source ~/.nvm/nvm.sh && node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS --wait
```

- Blocks until actionable work appears, then outputs JSON and exits
- Parse the output for task slug, project, and DB path
- **After completing a task:** Run `--wait` again. Never go idle.

---

## How to Work a Task

```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

# 1. Parse --wait output for slug and project DB path

# 2. Get full DNA
DATABASE_PATH=$DB node $CLI get <slug>

# 3. Check: is YOUR work already in DNA but task still assigned to you?
#    This means you completed the work in a previous session but missed the transition.
#    → Skip to step 6 (transition forward). The transition IS the handoff.
#    Examples: pdsa_review exists but task still at review+pdsa → execute review->review:pdsa
#              findings exists but task still at active+pdsa → execute transition to approval

# 4a. Claim it (only if not already active/review with your work)
DATABASE_PATH=$DB node $CLI transition <slug> active $ARGUMENTS

# 4b. TASK START brain marker
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{\"prompt\": \"TASK START: $(echo $ARGUMENTS | tr a-z A-Z) claiming <slug> (<project>) — <DNA title>\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\", \"thought_category\": \"transition_marker\", \"topic\": \"<slug>\"}"

# 5. Do the work described in DNA

# 6. Write results back to DNA
DATABASE_PATH=$DB node $CLI update-dna <slug> '{"findings":"..."}' $ARGUMENTS

# 7a. Transition forward — THIS IS MANDATORY, work is NOT done without it
DATABASE_PATH=$DB node $CLI transition <slug> <next-state> $ARGUMENTS

# 7b. TASK TRANSITION brain marker (auto-emitted by CLI brain gate, but contribute if manual)
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{\"prompt\": \"TASK active→<next-state>: $(echo $ARGUMENTS | tr a-z A-Z) <slug> (<project>) — <outcome, 1 sentence>\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\", \"thought_category\": \"transition_marker\", \"topic\": \"<slug>\"}"

# 7c. If transition fails (brain down, DB error), BLOCK the task:
# DATABASE_PATH=$DB node $CLI update-dna <slug> '{"blocked_reason":"Brain API unavailable"}' $ARGUMENTS
# DATABASE_PATH=$DB node $CLI transition <slug> blocked $ARGUMENTS
# Then contribute TASK BLOCKED marker when brain recovers.

# 7d. Post-completion micro-gardening (Layer 3)
# Only runs when: (1) layer3_enabled is true AND (2) the completion transition succeeded
# (i.e., next-state is "complete" or equivalent complete transition).
# This is a best-effort step — gardener failure does not block task completion.
# The transition in 7a is already done; this is cleanup.
#
# If layer3_enabled is false, skip this step entirely.
#
# When enabled on a complete transition, call the gardener engine skill
# with scope=task:<slug> and depth=micro:
#
# /xpo.claude.mindspace.garden task:<slug> micro
#
# The micro-gardening pass:
# - Consolidates scattered task-related thoughts into a summary learning
# - Archives intermediate entries (TASK START transition markers, status updates)
# - Creates ONE consolidation thought summarizing what the task learned
# - Does NOT do cross-domain work or highway curation (that's deep depth)
#
# If the gardener fails (brain down, timeout, error), log the error and continue.
# The task is already complete — gardening is optional cleanup.

# 8. Contribute key learnings to memory
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{\"prompt\": \"YOUR KEY LEARNING FROM THIS TASK\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\"}"
```

**CRITICAL: Work = DNA + Transition.** Writing findings to DNA without executing the transition leaves the task stuck. If `--wait` returns a task where your output is already in DNA, the transition was missed — execute it immediately. Do not dismiss it as "already done."

**Project databases** (all under `/home/developer/workspaces/github/PichlerThomas/`):
- xpollination-mcp-server: `xpollination-mcp-server/data/xpollination.db`
- HomePage: `HomePage/data/xpollination.db`
- xpollination-best-practices: `xpollination-best-practices/data/xpollination.db`

---

## Role-Specific Transitions (CRITICAL)

Each role has specific transitions to execute after completing work. Using the wrong transition leaves tasks stuck.

### PDSA transitions
| From State | Action | Transition Command |
|-----------|--------|-------------------|
| `ready+pdsa` | Claim task | `transition <slug> active pdsa` |
| `active+pdsa` | Submit design for approval | `transition <slug> approval pdsa` |
| `rework+pdsa` | Reclaim rework | `transition <slug> active pdsa` |
| **`review+pdsa`** | **Forward reviewed task to liaison** | **`transition <slug> review pdsa`** (triggers `review->review:pdsa`, sets role to liaison) |

### DEV transitions
| From State | Action | Transition Command |
|-----------|--------|-------------------|
| `ready+dev` | Claim task | `transition <slug> active dev` |
| `active+dev` | Submit for QA review | `transition <slug> review dev` |
| `rework+dev` | Reclaim rework | `transition <slug> active dev` |

### QA transitions
| From State | Action | Transition Command |
|-----------|--------|-------------------|
| `approved+qa` | Claim for testing | `transition <slug> active qa` |
| `review+qa` | Forward to PDSA after review | `transition <slug> review qa` (triggers `review->review:qa`, sets role to pdsa) |
| `review+qa` | Send back for rework | `transition <slug> rework qa` |

### LIAISON transitions (MODE-AWARE — check `liaison_approval_mode`)

The `--wait` output includes `liaison_approval_mode` (auto/semi/manual). LIAISON **must** behave differently per mode:

**AUTO mode:** Present a brief summary, then execute the transition immediately. Add `liaison_reasoning` to DNA documenting rationale. No human interaction.

**SEMI mode:** Present full task details (title, findings, reviews, implementation), then **STOP and wait for Thomas to type his decision**. Do NOT use `AskUserQuestion` — it produces empty answers (documented 2026-03-02). Thomas will type "approve", "rework", "complete", or feedback. Do NOT proceed until Thomas's text response appears.

**MANUAL mode:** Present full task details. Tell Thomas to click **Confirm** in the mindspace viz UI. STOP and wait for Thomas to confirm he clicked. The engine requires `human_confirmed=true` in DNA (set by viz click).

**Check mode before EVERY transition:**
```bash
curl -s http://localhost:4100/api/settings/liaison-approval-mode
```
Thomas can change mode at any time via viz. NEVER cache the mode.

| From State | Action | Transition Command |
|-----------|--------|-------------------|
| `review+liaison` | Present to Thomas → he approves | `transition <slug> complete liaison` |
| `review+liaison` | Present to Thomas → he rejects | `transition <slug> rework liaison` |
| `approval` | Present design to Thomas → he approves | `transition <slug> approved liaison` |
| `approval` | Present design to Thomas → he rejects | `transition <slug> rework liaison` |

### Review Chain
```
review+qa → review+pdsa (actor: qa)
review+pdsa → review+liaison (actor: pdsa)
review+liaison → complete (actor: liaison)
```
Each agent reviews, writes findings to DNA, then executes their transition to forward the task.

---

## Process Rules

### Monitoring Is Role-Only

You see ALL non-terminal tasks assigned to your role. The workflow engine moves the role field automatically on transitions. You do not need to know which statuses to watch — just listen for your name.

### Communication

- **PM system (task DNA)** = only task channel. DNA is self-contained.
- **Memory** = shared knowledge. Query before decisions, contribute after learnings.
- Agents NEVER communicate directly.

### Git Protocol

After every file write/edit, commit and push IMMEDIATELY:
```bash
git add <specific-file>
git commit -m "type: description"
git push
```
NEVER `git add .` or `git add -A`. Atomic commands — no `&&` chaining.

---

## Roles

### LIAISON
Bridge between Thomas (human) and agents. Creates tasks with complete DNA. Executes human-decision transitions (approve, reject, reopen). Presents work for review. **Never** does agent work.

### PDSA
Plans, researches, designs. Produces PDSA documents. Verifies dev implementation matches design. **Never** implements code.

### DEV
Implements what PDSA designed. Reads DNA, builds, submits for review. **Never** changes tests. **Never** plans. If tests fail, fix implementation or escalate via DNA.

### QA
Writes tests from approved designs. Reviews dev implementations by running tests. **Never** fixes implementation code — write failing tests, let dev fix.

---

## Reference

- Workflow: `xpollination-mcp-server/tracks/process/context/WORKFLOW.md`
- Monitor script: `xpollination-mcp-server/viz/agent-monitor.cjs`
- Memory API: `POST http://localhost:3200/api/v1/memory`
- Memory health: `GET http://localhost:3200/api/v1/health`
- Brain skill: `~/.claude/skills/brain/SKILL.md`

## Permission Model

Agents launched via `claude-session.sh` use `--allowedTools` to pre-approve ~50 tool patterns (node, git, curl, tmux, sqlite3, Read, Edit, Write, etc.). This eliminates permission prompts at launch.

**Config location:** `ALLOWED_TOOLS` array in `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/claude-session.sh`

## Auto-Compact Recovery (Automated)

When Claude's context window fills up, auto-compact triggers. This is handled **automatically by hooks** — no agent action required.

**How it works:**
1. Claude Code detects context pressure → triggers auto-compact
2. `SessionStart` hook (matcher: `compact`) fires after compaction
3. Hook runs `xpo.claude.compact-recover.sh` which queries brain for role recovery
4. Recovery context (role, task state, instructions) is injected into agent context
5. Agent continues working with recovered state

**What survives compaction (no hook needed):**
- CLAUDE.md (all levels)
- `--append-system-prompt` content (role identity)
- This skill (loaded at session start)

**What the hook recovers:**
- Role-specific operational knowledge from brain
- Current task state and recent decisions
- Key learnings from previous work

**Requirements:**
- `AGENT_ROLE` env var set at launch (done by `claude-session.sh`)
- Brain API at `localhost:3200`
- Hook configured in `~/.claude/settings.json`

**Script:** `xpollination-best-practices/scripts/xpo.claude.compact-recover.sh`
**Hook config:** `~/.claude/settings.json` → `SessionStart` → matcher: `compact`

## Installation (new machine)

```bash
# Install all skills (symlinks — auto-update on git pull)
for skill in xpo.claude.monitor xpo.claude.mindspace.brain xpo.claude.mindspace.pm.status; do
  ln -sfn /home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/.claude/skills/$skill ~/.claude/skills/$skill
done

# Backward compat symlink for brain skill (allows /brain invocation)
ln -sfn xpo.claude.mindspace.brain ~/.claude/skills/brain

# Merge hook config (preserves local settings, adds missing hooks)
node xpollination-best-practices/scripts/xpo.claude.sync-settings.js \
  xpollination-best-practices/scripts/xpo.claude.settings.json \
  ~/.claude/settings.json
```

**Auto-deploy:** `claude-session.sh` runs `sync_skills()` + `sync_settings()` on every session
creation — skills and hooks auto-deploy from git source. No manual install needed after first setup.
