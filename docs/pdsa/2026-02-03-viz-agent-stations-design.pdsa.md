# PDSA: Agent-Station Live Visualization Design

**Date:** 2026-02-03
**Node:** viz-agent-stations-design (ACTIVE)
**Requirement:** viz-agent-stations-live
**REQUIRES THOMAS REVIEW BEFORE IMPLEMENTATION**

## PLAN

### Objective
Design a visualization enhancement that shows:
1. Which agent is working on which node (station assignment)
2. Auto-updating view (real-time or near-real-time)
3. Thomas (human) integrated into the view

### Current Visualization State
- Shows nodes grouped by type (requirement, design, task, test)
- Shows status as color
- Shows DAG dependencies as arrows
- Detail panel shows node metadata
- NO agent assignment information
- NO auto-update (manual refresh button)

### Proposed Enhancements

#### 1. Agent-Station Assignment Schema

Add to `mindspace_nodes` table (or new table):
```sql
-- Option A: Add column to existing table
ALTER TABLE mindspace_nodes ADD COLUMN assigned_agent TEXT;
-- Values: 'pdsa', 'dev', 'qa', 'orchestrator', 'human', null

-- Option B: New assignment table (more flexible)
CREATE TABLE agent_assignments (
  id TEXT PRIMARY KEY,
  node_id TEXT REFERENCES mindspace_nodes(id),
  agent_name TEXT NOT NULL,  -- 'pdsa', 'dev', 'qa', 'orchestrator', 'human'
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME,
  is_active INTEGER DEFAULT 1
);
```

**Recommendation:** Option A is simpler and sufficient for current needs.

#### 2. Agent Assignment Flow

| When | Action | Agent Value |
|------|--------|-------------|
| PDSA claims design task | `assigned_agent = 'pdsa'` | pdsa |
| Dev claims implementation task | `assigned_agent = 'dev'` | dev |
| QA claims test task | `assigned_agent = 'qa'` | qa |
| Orchestrator monitoring | No assignment (observer role) | - |
| Thomas reviewing | `assigned_agent = 'human'` | human |
| Task completed | `assigned_agent = null` | null |

Assignment happens when agent sets status to `active`.

#### 3. Visual Representation

```
┌──────────────────────────────────────────────────────────────┐
│ REQUIREMENTS    DESIGNS        TASKS          TESTS          │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│ │            │  │ [PDSA]     │  │ [DEV]      │  │          │ │
│ │ viz-req    │  │ viz-design │  │ viz-impl   │  │ viz-test │ │
│ │ ●          │  │ ⚙️ active   │  │ ⚙️ active   │  │ ○        │ │
│ └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
│                                                              │
│ Legend: [PDSA] [DEV] [QA] [HUMAN] = agent badge              │
│         ⚙️ = working, ● = done, ○ = pending                  │
└──────────────────────────────────────────────────────────────┘
```

Agent badges:
- `[PDSA]` - Blue badge
- `[DEV]` - Yellow badge
- `[QA]` - Purple badge
- `[HUMAN]` - Green badge with star
- No badge = unassigned

#### 4. Auto-Update Implementation

```javascript
// Poll interval (configurable)
const AUTO_UPDATE_INTERVAL = 5000; // 5 seconds

// Start auto-update
let autoUpdateTimer = null;

function startAutoUpdate() {
  if (autoUpdateTimer) return;
  autoUpdateTimer = setInterval(loadData, AUTO_UPDATE_INTERVAL);
  document.getElementById('auto-update-status').textContent = 'Auto-update: ON';
}

function stopAutoUpdate() {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer);
    autoUpdateTimer = null;
  }
  document.getElementById('auto-update-status').textContent = 'Auto-update: OFF';
}

// Toggle button
document.getElementById('auto-update-btn').onclick = () => {
  if (autoUpdateTimer) stopAutoUpdate();
  else startAutoUpdate();
};
```

#### 5. Human Integration

Thomas appears when:
- Reviewing a deliverable (manual assignment)
- Approving a phase gate
- Providing feedback

Human assignment options:
1. **Manual via MCP** - Thomas or orchestrator sets `assigned_agent = 'human'`
2. **Via visualization UI** - Click node → "Assign to Human" button
3. **Automatic** - When status is `pending_review` (new status)

**Recommendation:** Start with manual assignment, add UI later.

#### 6. Missing States Identified

Current statuses: `pending`, `ready`, `active`, `done`, `completed`

Additional statuses needed for agent visualization:
- `in_review` - Waiting for human review
- `blocked` - Cannot proceed (dependency issue)

Or use `assigned_agent = 'human'` instead of new status.

### Data Export Enhancement

Update `data.json` to include:
```json
{
  "nodes": [
    {
      "slug": "viz-design",
      "assigned_agent": "pdsa",
      ...
    }
  ]
}
```

### UI Changes Summary

| Component | Change |
|-----------|--------|
| Package box | Add agent badge above/beside slug |
| Header | Add auto-update toggle and status |
| Legend | Add agent badge legend |
| Detail panel | Show assigned agent |

## Acceptance Criteria
- [ ] `assigned_agent` column exists in mindspace_nodes
- [ ] Agent badges displayed on packages when assigned
- [ ] Auto-update toggle in header (5s interval)
- [ ] Auto-update status indicator visible
- [ ] Human badge distinguished from other agents
- [ ] Detail panel shows assigned agent
- [ ] Legend includes agent badge colors

## DO

### Handoff Notes for Dev
1. Add `assigned_agent` column to schema
2. Update export script to include assigned_agent
3. Modify `renderPackages()` to show badges
4. Add auto-update toggle with interval logic
5. Update legend with agent colors
6. Test with manual agent assignments

**HOLD FOR THOMAS REVIEW** - This design requires approval before implementation.

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)
