# PDSA: Process Improvement - MCP-Driven Autonomous Workflow

**Date:** 2026-02-03
**Type:** Process Improvement
**Context:** Learnings from viz-prototype workflow (7 nodes, 3 agents)

## PLAN

### Objective
Document and formalize the MCP-driven autonomous task discovery pattern that emerged during the visualization prototype workflow.

### Problem Statement
After server recovery, agents need to resume work without manual context transfer. The conversation context is volatile (lost on restart), but the MCP database persists.

### Proposed Process

```
┌─────────────────────────────────────────────────────────────┐
│                  MCP-Driven Task Flow                        │
├─────────────────────────────────────────────────────────────┤
│  1. Agent queries MCP database for tasks matching role       │
│  2. Agent claims task by setting status='active'             │
│  3. Agent executes task (PDSA plans, Dev implements, QA tests)│
│  4. Agent marks task status='completed'                      │
│  5. Agent polls for next task                                │
│  6. Repeat until no pending tasks                            │
└─────────────────────────────────────────────────────────────┘
```

### Role-to-Task Mapping

| Role | Task Types | Actions |
|------|------------|---------|
| PDSA+QA | design, test | Plan architecture, write PDSA docs, run tests, verify quality |
| Dev | task | Implement code, follow git protocol, report completion |
| Orchestrator | - | Monitor, relay, confirm prompts |

### Query Pattern
```javascript
// PDSA+QA agent scans for work
const myTasks = db.prepare(`
  SELECT * FROM mindspace_nodes
  WHERE type IN ('design', 'test')
  AND status IN ('pending', 'active')
  ORDER BY created_at ASC
`).all();
```

### Recovery Protocol
1. Query MCP: `SELECT slug, status FROM mindspace_nodes WHERE status='active'`
2. If active task found → resume that task
3. If no active task → scan for pending tasks matching role
4. If no pending tasks → report IDLE, continue polling

## DO

### Implementation (Today's Session)
1. Server halted mid-workflow
2. On recovery, PDSA agent queried MCP database
3. Found `viz-design` node with status='active'
4. Resumed design work, created PDSA document
5. Marked `viz-design` completed, `viz-impl` active
6. Dev agent implemented (orchestrator relayed)
7. PDSA+QA agent tested, marked `viz-test` completed
8. New workflow appeared (`viz-public-*`)
9. PDSA+QA autonomously detected, tested, completed

### Success Metrics
- **Recovery time:** < 2 minutes (query + understand state)
- **Context loss:** None (MCP preserved all state)
- **Manual intervention:** Minimal (orchestrator confirmed prompts only)

## STUDY

### What Worked
1. **MCP as source of truth** - Survived server restart
2. **Status-based task discovery** - Agents find work without being told
3. **Quality gates in PDSA** - Clear acceptance criteria
4. **Node type → role mapping** - Unambiguous task ownership
5. **Atomic status transitions** - No race conditions

### What Needs Improvement
1. **Polling frequency** - Currently manual, should be periodic
2. **Blocking dependencies** - `parent_ids` not checked before claiming task
3. **Data export sync** - `data.json` must be regenerated after status changes
4. **Orchestrator confirmation overhead** - Permission prompts slow down flow

### Metrics from Today
| Metric | Value |
|--------|-------|
| Total nodes | 7 |
| Workflows completed | 2 (viz-prototype, viz-public) |
| Agent handoffs | 4 (PDSA→Dev→PDSA for each workflow) |
| Server recoveries | 1 |
| Manual interventions | 3 (orchestrator relays) |

## ACT

### Process Updates for CLAUDE.md

**Add to Multi-Agent Coordination Protocol:**

```markdown
### MCP-Driven Task Discovery
- Agents query MCP database on startup and periodically for tasks matching their role
- PDSA+QA agent: `type IN ('design', 'test')`
- Dev agent: `type = 'task'`
- Status flow: pending → active → completed/done
- Recovery: Query for active tasks first, then pending

### Scan Loop Pattern
```bash
# PDSA+QA agent scan loop
while true; do
  node -e "..." # query for design/test tasks
  if task_found; then
    claim_task  # status='active'
    execute_task
    complete_task  # status='completed'
  fi
  sleep 60  # poll interval
done
```
```

### Recommendations
1. **Implement blocking check** - Before claiming task, verify `parent_ids` are all completed
2. **Auto-export data.json** - Trigger export when any node status changes
3. **Reduce permission prompts** - Use session-wide allows where safe
4. **Add scan loop command** - Standardize autonomous monitoring

---

## Appendix: Today's Workflow Trace

```
[14:38] PDSA agent recovered from halt
[14:38] Query MCP → viz-design ACTIVE
[14:38] Create PDSA doc, commit, push
[14:55] Mark viz-design completed, viz-impl active
[14:58] Dev agent implements viz/ (orchestrator relayed)
[15:02] Dev marks viz-impl done
[15:03] PDSA agent runs tests, all pass
[15:04] Mark viz-test completed
[15:10] MCP scan → viz-public-* nodes detected
[15:10] Server already bound to 0.0.0.0 (no dev work needed)
[15:11] PDSA tests public access → PASS
[15:11] Mark viz-public-* completed
[15:12] MCP scan → no pending tasks → IDLE
```

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-process-improvement-mcp-autonomous-workflow.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-process-improvement-mcp-autonomous-workflow.pdsa.md
