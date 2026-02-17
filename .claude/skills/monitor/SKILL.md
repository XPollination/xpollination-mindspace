---
name: monitor
description: Start agent monitoring and load process instructions
user-invocable: true
allowed-tools: Bash, Read, TaskStop, TaskOutput
---

# Agent Monitor & Process Bootloader

Start monitoring for your role, load operating instructions, and **work autonomously while staying responsive**.

```
/monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Step 1: Start Background Monitor (writes work file)

```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

## Step 2: Start Background Work Detection Loop

Start a **background bash loop** using `run_in_background: true` that polls the work file and logs when work is found. This keeps you responsive to human messages.

```bash
while true; do
  SIZE=$(stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 0 ]; then
    echo "[$(date +%H:%M:%S)] WORK DETECTED ($SIZE bytes)"
    cat /tmp/agent-work-$ARGUMENTS.json
  else
    echo "[$(date +%H:%M:%S)] no work"
  fi
  sleep 30
done
```

**IMPORTANT:** Use `run_in_background: true` on this Bash call. Report the background task ID.

## Step 3: Check for Work and Act

After starting both background processes, immediately do one check:

```bash
stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
```

- If work found: read it, claim the task, do the work (see "How to Work a Task" below)
- If no work: tell the human you're monitoring and ready. Stay at the prompt.

**To check later** (non-blocking): read the background task output file to see if work was detected.

When you finish a task, check for more work. Between tasks, stay at the prompt — the human can talk to you and the background loop keeps watching.

---

## Process Rules

### MCP/PM System Is the ONLY Communication Channel

Agents NEVER communicate directly.

```
Task DNA (database) → interface-cli.js → agent-monitor → work file → you read DNA → work → write results to DNA → transition
```

- DNA is **SELF-CONTAINED** — all file paths, requirements, acceptance criteria, full context
- `tmux send-keys` is ONLY for `/unblock` (permission prompts). NEVER for task instructions.

### How to Work a Task

```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

# 1. Read work file to find task slug and DB path
cat /tmp/agent-work-$ARGUMENTS.json

# 2. Get full DNA
DATABASE_PATH=$DB node $CLI get <slug>

# 3. Claim it
DATABASE_PATH=$DB node $CLI transition <slug> active $ARGUMENTS

# 4. Do the work described in DNA

# 5. Write your results back to DNA
DATABASE_PATH=$DB node $CLI update-dna <slug> '{"findings":"..."}' $ARGUMENTS

# 6. Transition forward (engine validates — if wrong, you get an error, try another state)
DATABASE_PATH=$DB node $CLI transition <slug> <next-state> $ARGUMENTS
```

**Project databases** (all under `/home/developer/workspaces/github/PichlerThomas/`):
- xpollination-mcp-server: `.../xpollination-mcp-server/data/xpollination.db`
- HomePage: `.../HomePage/data/xpollination.db`
- best-practices: `.../best-practices/data/xpollination.db`

### Git Protocol

After every file write/edit, commit and push IMMEDIATELY:
```bash
git add <specific-file>
git commit -m "type: description"
git push
```
NEVER `git add .` or `git add -A`. Atomic commands — no `&&` chaining.

---

## Your Role

### LIAISON
Bridge between Thomas (human) and agents. Creates tasks with complete DNA. Executes transitions when Thomas decides (approve, reject, reopen). Presents work to Thomas for review. **Never** sends instructions via tmux. **Never** does agent work.

### PDSA
Plans, researches, designs. Produces PDSA documents. At review stage, verifies dev implementation matches your design (not "do tests pass" — that's QA). **Never** writes implementation code.

### DEV
Implements what PDSA designed. Reads DNA, builds it, submits for review. **Never** changes tests (tests ARE the specification). **Never** plans or designs. If tests fail, fix implementation — if impossible, escalate via DNA with `dev_blocker`.

### QA
Writes tests from approved designs. Reviews dev implementations by running tests. **Never** fixes implementation code — write failing tests that expose the bug, let dev fix it.

---

## Reference

- Workflow source of truth: `docs/Knowledge Management (Single Source of Truth, keep up2date!)/WORKFLOW.md`
- Unblock skill: `~/.claude/skills/unblock/SKILL.md`
- Monitor script: `xpollination-mcp-server/viz/agent-monitor.cjs`
