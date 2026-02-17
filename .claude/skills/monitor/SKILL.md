---
name: monitor
description: Start agent monitoring and load role-specific process instructions (WORKFLOW.md v12)
user-invocable: true
allowed-tools: Bash, Read
---

# Agent Monitor & Process Bootloader

**This skill is duplicated from the global version at `~/.claude/skills/monitor/SKILL.md`.**
**The global version is the source of truth. Keep them in sync.**

Start monitoring for your role AND load operating instructions. Run this at every session start.

## Usage

```
/monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

## Quick Start

1. Kill existing monitor:
```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
```

2. Start monitor:
```bash
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

3. Verify:
```bash
sleep 2 && tail -5 /tmp/agent-monitor-$ARGUMENTS.log
```

4. Check for work:
```bash
stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
```

## PROCESS REMINDER — READ THIS

### MCP/PM System Is the ONLY Communication Channel

Agents NEVER communicate directly. No tmux send-keys for task instructions.

The flow:
```
Task DNA (in database) ←→ interface-cli.js ←→ agent-monitor.cjs ←→ agent reads work file
```

- Tasks have SELF-CONTAINED DNA — all info the receiving agent needs
- Agents discover work through monitors polling the database
- Results written BACK to DNA via `update-dna` before transitioning
- `tmux send-keys` is ONLY for `/unblock` (permission prompt confirmation)

### Interface CLI

```bash
DB=/path/to/project/data/xpollination.db
DATABASE_PATH=$DB node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js get <slug>
DATABASE_PATH=$DB node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js list --status=ready --role=dev
DATABASE_PATH=$DB node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js transition <slug> active <actor>
DATABASE_PATH=$DB node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js update-dna <slug> '{"findings":"..."}' <actor>
DATABASE_PATH=$DB node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js create task <slug> '<dnaJson>' <actor>
```

### Role Quick Reference

| Role | Does | Never Does |
|------|------|-----------|
| LIAISON | Creates tasks with complete DNA, executes human-decision transitions, presents to Thomas | Sends tmux instructions, does agent work |
| PDSA | Claims design tasks, produces PDSA docs, verifies design match | Writes implementation code |
| DEV | Implements what PDSA designed, submits for review | Changes tests, plans/designs |
| QA | Writes tests from approved designs, reviews implementations | Fixes implementation code |

### Git Protocol
After every file write/edit: `git add <file>` → `git commit -m "type: desc"` → `git push`

### Full Process Instructions
See global skill: `~/.claude/skills/monitor/SKILL.md`
