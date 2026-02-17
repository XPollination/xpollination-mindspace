---
name: monitor
description: Start agent monitoring and load process instructions
user-invocable: true
allowed-tools: Bash, Read
---

# Agent Monitor & Process Bootloader

Start monitoring for your role AND load operating instructions. Run at every session start.

```
/monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Start Monitor

```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
sleep 2 && tail -5 /tmp/agent-monitor-$ARGUMENTS.log
```

Check for work:
```bash
stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
```
`0` = no work. `>0` = read with `cat /tmp/agent-work-$ARGUMENTS.json`.

---

## Process Rules (your operating manual)

### 1. MCP/PM System Is the ONLY Communication Channel

Agents NEVER communicate directly.

```
Task DNA (database) → interface-cli.js → agent-monitor → work file → agent reads DNA → works → writes results to DNA → transitions
```

- DNA must be **SELF-CONTAINED** — all file paths, requirements, acceptance criteria, full context
- If someone reads ONLY the DNA, they can do the work without any other information
- `tmux send-keys` is ONLY for `/unblock` (permission prompts). NEVER for task instructions.

### 2. Work Cycle (same for all roles)

1. Monitor finds work → read work file
2. Get full DNA: `DATABASE_PATH=$DB node .../interface-cli.js get <slug>`
3. Claim: `transition <slug> active <your-role>`
4. Do the work
5. Write results to DNA: `update-dna <slug> '{"findings":"..."}' <your-role>`
6. Transition forward: `transition <slug> <next-state> <your-role>`

The workflow engine validates every transition. If it's invalid, you get an error. You don't need to memorize which transitions are allowed — just try, and the engine tells you.

### 3. Interface CLI

```bash
DB=/path/to/project/data/xpollination.db
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

DATABASE_PATH=$DB node $CLI get <slug>
DATABASE_PATH=$DB node $CLI list
DATABASE_PATH=$DB node $CLI transition <slug> <status> <actor>
DATABASE_PATH=$DB node $CLI update-dna <slug> '<json>' <actor>
DATABASE_PATH=$DB node $CLI create task <slug> '<dnaJson>' <actor>
```

**Project databases:**
- xpollination-mcp-server: `.../xpollination-mcp-server/data/xpollination.db`
- HomePage: `.../HomePage/data/xpollination.db`
- best-practices: `.../best-practices/data/xpollination.db`

(All under `/home/developer/workspaces/github/PichlerThomas/`)

### 4. Git Protocol

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
