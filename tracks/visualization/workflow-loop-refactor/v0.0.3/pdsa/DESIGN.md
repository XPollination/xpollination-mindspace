# PDSA: Viz Workflow Redesign — v0.0.3

## REWORK CONTEXT

> **Thomas feedback (2026-03-04, liaison_rework_reason_3):**
> "i like it VERY much! small changes: 1. ensure that object details get updated automatically when i have a task in focus and it switches the state, then i want to automatically have it also reflected in the object details. 2. add light mode to switch. simple implementation. (current layout and colors are very good!) 3. real estate. blocked and canceled take too much space. need to have a collapse option in there so i can push that part to the bottom and have more visibility on what the process focuses. when i uncollapse it - then its fine as it is now. 4. add a filter to blocked/cancelled so i have the option to filter for only blocked."

Thomas APPROVED: Kanban board layout, colors, overall design.
Thomas REQUIRES: 4 refinements (detail auto-refresh, light mode, collapsible blocked section, blocked/cancelled filter).

## PLAN

### Changes (4 small, independent refinements)

#### 1. Detail Panel Auto-Refresh

**Problem:** When a task is open in the detail panel and its state changes (e.g., status transitions via another agent), the detail panel shows stale data until manually re-clicked.

**Current behavior:** `pollData()` calls `renderVisualization()` on data change, which re-renders all task cards. But it does NOT re-render the detail panel for the selected node.

**Fix:** After `renderVisualization()` in `pollData()`, check if `selectedNodeId` is set. If so, find the updated node from the new `nodes` array and call `showDetail(updatedNode)` to refresh the detail panel content.

```javascript
// In pollData(), after renderVisualization() (line ~907):
if (selectedNodeId) {
  const updatedNode = nodes.find(n => n.id === selectedNodeId);
  if (updatedNode) {
    showDetail(updatedNode, false);  // false = don't scroll
  } else {
    // Node disappeared (e.g., deleted or filtered out) — close panel
    hideDetail();
    selectedNodeId = null;
  }
}
```

~8 lines added to `pollData()`.

#### 2. Light Mode Toggle

**Problem:** Thomas wants a light mode alternative. Current dark mode colors are approved.

**Design:** Add a toggle button in the settings bar area. Use a CSS class `light-mode` on `<body>` to invert the color scheme.

- Button: sun/moon icon or simple "Light/Dark" text toggle
- Position: next to the existing settings controls (near liaison mode dropdown)
- Persist preference in `localStorage` so it survives page refresh
- CSS: Define `.light-mode` overrides for background, text, card colors, borders

```css
body.light-mode {
  background: #f5f5f5;
  color: #1a1a1a;
}
body.light-mode .kanban-column {
  background: #ffffff;
  border-color: #e0e0e0;
}
body.light-mode .task-card {
  background: #ffffff;
  border-color: #e0e0e0;
  color: #1a1a1a;
}
body.light-mode .detail-panel {
  background: #ffffff;
  border-color: #e0e0e0;
  color: #1a1a1a;
}
body.light-mode .agent-status-bar {
  background: #ffffff;
  border-color: #e0e0e0;
}
/* Role colors stay the same — they're bright enough for both modes */
```

```javascript
// Toggle button handler
const themeBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('viz-theme');
if (savedTheme === 'light') document.body.classList.add('light-mode');

themeBtn.onclick = () => {
  document.body.classList.toggle('light-mode');
  localStorage.setItem('viz-theme',
    document.body.classList.contains('light-mode') ? 'light' : 'dark'
  );
};
```

~20 lines CSS + ~8 lines JS.

#### 3. Blocked/Cancelled Collapsible

**Problem:** The blocked/cancelled bottom bar takes too much vertical space, reducing visibility of the active process columns.

**Design:** Add a collapse/expand toggle button to the blocked bottom bar header. When collapsed, show only the header with a count badge. When expanded, show full card layout (current behavior).

- Default state: collapsed (to prioritize process visibility)
- Toggle: click the header bar or a chevron icon
- Persist in `localStorage`
- Show count in collapsed state: "BLOCKED (3) / CANCELLED (1) ▸"

```javascript
// In blocked bar header:
blockedHeader.onclick = () => {
  blockedBottomBar.classList.toggle('collapsed');
  localStorage.setItem('viz-blocked-collapsed',
    blockedBottomBar.classList.contains('collapsed') ? '1' : '0'
  );
};
```

```css
.blocked-bottom-bar.collapsed .blocked-cards {
  display: none;
}
.blocked-bottom-bar.collapsed .bar-header {
  cursor: pointer;
}
```

~10 lines CSS + ~10 lines JS.

#### 4. Blocked/Cancelled Filter

**Problem:** Thomas wants to filter blocked section to show only blocked OR only cancelled.

**Design:** Add filter buttons in the blocked bar header: "All" | "Blocked" | "Cancelled".

- Default: "All" (shows both)
- Clicking "Blocked" hides cancelled cards, clicking "Cancelled" hides blocked cards
- Visual: active filter gets highlight styling
- Works with the collapsible toggle (filter persists when expanded/collapsed)

```javascript
// Filter state
let blockedFilter = 'all'; // 'all', 'blocked', 'cancelled'

// In renderBlockedSection(), filter nodes:
const filteredNodes = blockedNodes.filter(n => {
  if (blockedFilter === 'blocked') return n.status === 'blocked';
  if (blockedFilter === 'cancelled') return n.status === 'cancelled';
  return true;
});
```

~5 lines CSS + ~15 lines JS.

### Changes Required

1. **`viz/index.html`** (~80 lines total):
   - `pollData()`: Add detail panel auto-refresh (~8 lines)
   - CSS: Add `.light-mode` overrides (~20 lines)
   - HTML: Add theme toggle button, blocked filter buttons (~5 lines)
   - JS: Theme toggle handler with localStorage (~8 lines)
   - JS: Blocked section collapse with localStorage (~10 lines)
   - JS: Blocked filter handler (~15 lines)
   - CSS: Blocked collapsed state + filter button styles (~10 lines)

2. **`viz/versions/v0.0.3/`**: Copy updated files, update `active` symlink

3. **No server.js changes needed** — all 4 features are client-side only

### What This Does NOT Do

- Does NOT change the Kanban column layout (approved)
- Does NOT change role colors or badges (approved)
- Does NOT change the data API or polling logic (structure unchanged)
- Does NOT add drag-and-drop or other new interactions

### Acceptance Criteria (v0.0.3)

1. Detail panel auto-refreshes when focused task state changes via polling
2. Light mode toggle works and persists via localStorage
3. Blocked/cancelled section collapses/expands with toggle
4. Collapsed state shows count badges for blocked and cancelled
5. Blocked/cancelled filter: can show All, Blocked only, or Cancelled only
6. v0.0.3 directory created, active symlink updated
7. v0.0.2 preserved (rollback available)

## DO

Implementation by DEV agent. All changes in `viz/index.html` (client-side only). ~80 lines added.

## STUDY

After implementation:
- Detail panel auto-refresh: open a task, trigger a transition from CLI, verify panel updates
- Light mode: toggle switch, verify readability, verify localStorage persistence
- Blocked collapse: collapse, verify cards hidden, expand, verify cards shown
- Blocked filter: filter blocked only, verify cancelled hidden; filter cancelled only, verify blocked hidden

## ACT

If Thomas approves: v0.0.3 becomes active. The Kanban board with these refinements is the standard viz.
