# PDSA: Node Highlight and Station-Based Visualization

**Date:** 2026-02-03
**Node:** viz-node-highlight-nav-design (96083628-2dbc-4488-bcc5-47a9c0a77326)
**Type:** Design
**Status:** AWAITING REVIEW
**Requirement:** viz-node-highlight-nav (2e552a57-c185-4eb5-aeca-d4f66b6d7464)

## PLAN

### Thomas's Requirements (verbatim)

> "when i am clicking on a node then it needs to highlight. when i am then doing child link or parent link then it shall also switch corresponding to that i have clicked as the next target"

> "when the pdsa agent is working on a requirement it is visualized then not in Queue (pending) but in the station PDSA"

### Three Requirements

| # | Requirement | Current | Proposed |
|---|-------------|---------|----------|
| 1 | Node highlight on click | No visual feedback | Highlighted border/glow |
| 2 | Switch highlight on nav | Detail panel updates only | Highlight moves to target |
| 3 | Station-based placement | Nodes grouped by status | Nodes show in working station |

---

## Design: Requirement 1 - Node Highlight

### Visual Style
```css
.package.selected {
  border: 2px solid #e94560;
  box-shadow: 0 0 12px rgba(233, 69, 96, 0.5);
}
```

### Behavior
- Click node → add `.selected` class
- Only ONE node selected at a time
- Previous selection loses `.selected`

### Implementation
```javascript
let selectedNodeId = null;

function selectNode(nodeId) {
  // Remove previous selection
  document.querySelectorAll('.package.selected').forEach(el =>
    el.classList.remove('selected')
  );

  // Add new selection
  selectedNodeId = nodeId;
  const el = document.querySelector(`.package[data-id="${nodeId}"]`);
  if (el) el.classList.add('selected');
}
```

---

## Design: Requirement 2 - Switch Highlight on Navigation

### Behavior
When clicking parent/child link in detail panel:
1. Highlight switches to clicked target node
2. Detail panel updates to show target
3. View scrolls/pans to target if off-screen

### Implementation
```javascript
// In parent/child link click handler
linkElement.onclick = () => {
  selectNode(targetNode.id);  // Switch highlight
  showDetail(targetNode);      // Update detail panel
  scrollToNode(targetNode.id); // Ensure visible
};
```

---

## Design: Requirement 3 - Station-Based Node Placement

### Current Model (WRONG)
```
Queue (pending)     Active           Completed
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ • req-1     │    │ • task-1    │   │ • done-1    │
│ • design-1  │    │             │   │ • done-2    │
└─────────────┘    └─────────────┘   └─────────────┘
```
Nodes grouped by STATUS - doesn't show WHO is working on them.

### Proposed Model (CORRECT)
```
┌─────────────────────────────────────────────────────────────┐
│                      STATIONS                                │
├─────────────┬─────────────┬─────────────┬─────────────┐     │
│   PDSA      │    Dev      │     QA      │   Human     │     │
│  Station    │  Station    │   Station   │  Station    │     │
├─────────────┼─────────────┼─────────────┼─────────────┤     │
│ [req-1]     │ [task-1]    │             │             │     │
│  working    │  working    │             │             │     │
└─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                              │
│  Queue (unassigned)              Completed                   │
│  ┌─────────────┐                ┌─────────────┐             │
│  │ • pending-1 │                │ • done-1    │             │
│  │ • pending-2 │                │ • done-2    │             │
│  └─────────────┘                └─────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Station Assignment Logic

A node shows in a station when:
1. Station has `current_object_id` pointing to that node, OR
2. Node's `status` matches the station's role work pattern

| Station | Shows nodes where... |
|---------|---------------------|
| PDSA | `stations.current_object_id = node.id` AND station.role='pdsa' |
| Dev | `stations.current_object_id = node.id` AND station.role='dev' |
| QA | `stations.current_object_id = node.id` AND station.role='qa' |
| Human | `stations.current_object_id = node.id` AND station.role='human' |
| Queue | Node has NO station assignment AND status NOT in (done, completed, cancelled) |
| Completed | Node status IN (done, completed) |

### Data Model

Current `stations` table already has `current_object_id`:
```sql
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT,
  agent_id TEXT,
  current_object_id TEXT,  -- ← This links station to active node
  status TEXT,
  created_at DATETIME
);
```

### Visualization Update

```javascript
function renderStations() {
  stations.forEach(station => {
    const stationEl = document.getElementById(`station-${station.role}`);

    // Find node assigned to this station
    const activeNode = nodes.find(n => n.id === station.current_object_id);

    if (activeNode) {
      stationEl.innerHTML = renderPackage(activeNode);
    } else {
      stationEl.innerHTML = '<div class="empty">No active work</div>';
    }
  });
}

function renderQueue() {
  // Nodes with no station assignment and not completed
  const assignedIds = stations.map(s => s.current_object_id).filter(Boolean);
  const queueNodes = nodes.filter(n =>
    !assignedIds.includes(n.id) &&
    !['done', 'completed', 'cancelled'].includes(n.status)
  );
  // render queueNodes...
}
```

---

## Acceptance Criteria

- [ ] Clicking a node highlights it with visible border/glow
- [ ] Only one node highlighted at a time
- [ ] Clicking parent link switches highlight to parent node
- [ ] Clicking child link switches highlight to child node
- [ ] Nodes with `station.current_object_id` pointing to them appear IN that station
- [ ] Queue only shows nodes with NO station assignment
- [ ] Completed area shows nodes with done/completed status

---

## Questions for Thomas

1. **Highlight style preference?** Border+glow, or different approach?
2. **Auto-scroll?** When navigating to off-screen node, should view auto-scroll?
3. **Station empty state?** What to show when a station has no active work?

---

## DO

(Awaiting Thomas review before implementation)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-viz-node-highlight-nav-design.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-viz-node-highlight-nav-design.pdsa.md
