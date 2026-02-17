---
name: monitor
description: Start agent monitoring and load process instructions
user-invocable: true
allowed-tools: Bash, Read
---

# Agent Monitor & Process Bootloader

Start monitoring for your role, load operating instructions, and **begin working autonomously**.

```
/monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Step 1: Start Background Monitor

```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
sleep 2 && tail -5 /tmp/agent-monitor-$ARGUMENTS.log
```

## Step 2: Enter Autonomous Work Loop

**After starting the monitor, you MUST enter this loop. Do not wait for instructions.**

```
REPEAT FOREVER:
  1. Check for work:  stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
  2. If 0 → sleep 30s → goto 1
  3. If >0 → read the work file → get task DNA → CLAIM IT → DO THE WORK → write results to DNA → transition forward
  4. After completing → goto 1
```

**You are autonomous.** When work appears, claim it immediately and do it. Do not ask for permission. Do not wait for instructions. The task DNA contains everything you need.

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
