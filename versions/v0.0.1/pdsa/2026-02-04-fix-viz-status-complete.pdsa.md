# PDSA: Fix Viz Status Filter for Complete

**Date:** 2026-02-04
**Node:** fix-viz-status-complete (d5b30aa4-64a8-4877-b4fa-65843ddacc98)
**Type:** Task
**Status:** ACTIVE

## PLAN

Update viz to recognize `complete` (without 'd') as valid completed status.

## DO (Findings)

### Problem
- Viz expects: `completed` or `done`
- DB has: `complete` (canonical per schema)
- Result: Nodes vanish from viz

### Fix Locations
1. `viz/index.html:967` - completedNodes filter
2. `viz/server.js:108` - completedCount
3. `viz/export-data.js:59` - completedCount

### Code Change
```javascript
// OLD
n.status === 'completed' || n.status === 'done'

// NEW
n.status === 'complete' || n.status === 'completed' || n.status === 'done'
```

## STUDY

Simple string match fix. No side effects.

## ACT

Handoff to dev: Update 3 files with new status check.

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-fix-viz-status-complete.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-fix-viz-status-complete.pdsa.md
