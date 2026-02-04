# Skill: Multi-Project DEV Monitoring

**Name:** dev-monitoring
**Role:** DEV Agent
**Created:** 2026-02-04

## Purpose

Monitor multiple projects in the workspace for implementation tasks assigned to the DEV role.

## Projects Monitored

| Project | Database Path |
|---------|---------------|
| xpollination-mcp-server | `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db` |
| HomePage | `/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db` |

## Monitoring Pattern

### Poll Interval
- **30 seconds** between checks
- Pause when actively processing work

### What to Monitor

**Query:** Nodes with `status='ready'` AND `role:dev` in dna_json

```sql
SELECT slug, type, status, dna_json
FROM mindspace_nodes
WHERE status = 'ready' AND dna_json LIKE '%"role":"dev"%'
```

- **Any type is valid:** task, design, requirement, etc.
- **Role determines assignment:** `role:dev` in dna_json
- **Status must be `ready`:** indicates work is available

### Running the Monitor

**IMPORTANT:** Do NOT run monitoring loops inside Claude - it wastes tokens.

Use the standalone monitor script instead:

```bash
# Start standalone monitor (runs outside Claude, saves tokens)
source ~/.nvm/nvm.sh
nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/dev-monitor.cjs --loop > /tmp/dev-monitor.log 2>&1 &

# Check monitor status
tail /tmp/dev-monitor.log

# Check if work is available
cat /tmp/dev-work-found.json 2>/dev/null || echo "No work"
```

**Files:**
- Script: `viz/dev-monitor.cjs`
- Log: `/tmp/dev-monitor.log`
- Work notification: `/tmp/dev-work-found.json` (created when work found)

**Workflow:**
1. Monitor runs independently in background
2. When work is found, it writes to `/tmp/dev-work-found.json`
3. Only invoke Claude when work file exists

### Single Check Mode

For a one-time check (useful for Claude):

```bash
node viz/dev-monitor.cjs
```

## Workflow When Task Found

1. **Claim task** - Update status to `active`
2. **Read full details** - Query `dna_json` for description and acceptance criteria
3. **Implement** - Follow git protocol (specific staging, atomic commands, immediate push)
4. **Complete** - Update status to `review` (not `done` - QA reviews first)

## Status Values (IMPORTANT)

Use these canonical status values when updating nodes:

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `ready` | Ready for work |
| `active` | Being worked on |
| `review` | Awaiting human review |
| `rework` | Needs changes |
| `complete` | **Finished (NO 'd')** |
| `blocked` | Cannot proceed |
| `cancelled` | Intentionally stopped |

**CRITICAL:** Use `complete` not `completed`. The 'd' suffix breaks visualization.

## Adding New Projects

To add a new project to monitoring:

1. Ensure the project has `data/xpollination.db` initialized
2. Add entry to the `projects` array in `viz/dev-monitor.cjs`
3. Restart monitoring loop

## Related Skills

- **PDSA Monitoring:** `.claude/skills/pdsa-monitoring.md` (for PDSA+QA agent)

---

**Dual format reference:**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/.claude/skills/dev-monitoring.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.claude/skills/dev-monitoring.md
