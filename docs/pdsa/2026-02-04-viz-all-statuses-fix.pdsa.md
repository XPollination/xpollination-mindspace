# PDSA: Fix Viz to Show ALL Status Values

**Date:** 2026-02-04
**Node:** enhance-viz-all-statuses (44ed5035-0f8e-417c-8ec1-5481ea9ff3b4)
**Type:** Task
**Status:** ACTIVE (rework)

## PLAN

### Problem Statement

Thomas reported: "Task marked complete but functionality not working."

Active nodes are invisible in the visualization.

### Goals

- AC1: All 8 status values visible in viz
- AC2: Active nodes shown correctly
- AC3: UI clearly distinguishes each status

---

## DO (Findings)

### Root Cause: Active Status Gap

**Code analysis of viz/index.html:**

| Section | Line | Filter | Statuses Shown |
|---------|------|--------|----------------|
| Queue | 937-941 | `status === 'pending' OR 'ready'` | pending, ready |
| Post-work | 986-991 | `postWorkStatuses.includes(status)` | complete, completed, done, review, rework, blocked, cancelled |
| Stations | 934-935 | `current_object_id` assignment | (none - all null) |

**The Gap:** `status='active'` is NOT handled!

- Not in queue (not pending/ready)
- Not in post-work (not in that list)
- Not assigned to stations (current_object_id is always null)

**Result:** Active nodes DISAPPEAR from the viz!

### Evidence

Database check shows 2 active nodes, 5 stations with null current_object_id:
```
Active nodes: 2
- onboard-homepage-design
- enhance-viz-all-statuses

Stations: 5 (all current_object_id = null)
```

### Fix Required

**Option A: Add active to station assignment**
When node transitions to active, update station.current_object_id.
- Pro: Uses existing station rendering
- Con: Requires workflow integration

**Option B: Add standalone "ACTIVE" section**
Add a new section that shows `status='active'` nodes not in stations.
- Pro: Simple fix, no workflow changes
- Con: Duplicates rendering logic

**Recommendation:** Option B (quick fix) then Option A later.

### Code Fix (Option B)

Add to viz/index.html after renderQueue():

```javascript
function renderActive() {
  // Show active nodes not assigned to stations
  const assignedIds = stations.map(s => s.current_object_id).filter(Boolean);
  const activeNodes = nodes.filter(n =>
    n.status === 'active' &&
    !assignedIds.includes(n.id) &&
    matchesSearch(n, searchQuery)
  );

  // Add ACTIVE section between QUEUE and POST-WORK
  const startY = LAYOUT.queueY + LAYOUT.queueHeight + 20;
  const startX = 15;

  activeNodes.forEach((node, index) => {
    // Same rendering as queue
  });
}
```

Also need to add ACTIVE section label and background.

---

## STUDY

### Validation

| Issue | Finding | Fix |
|-------|---------|-----|
| Active nodes invisible | Filter gap - not in any section | Add renderActive() function |
| Stations empty | current_object_id always null | Phase 2 - workflow integration |

### Impact

Without this fix, users cannot see what's being worked on. Critical visibility gap.

---

## ACT

### Implementation Tasks

1. **Dev task (immediate):** Add renderActive() section to viz/index.html
2. **Dev task (phase 2):** Update workflow to assign nodes to stations when status=active
3. **Test:** Verify all 8 statuses visible

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-viz-all-statuses-fix.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-viz-all-statuses-fix.pdsa.md
