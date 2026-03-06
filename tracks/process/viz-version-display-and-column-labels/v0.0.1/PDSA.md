# PDSA: Viz version display + column state labels

**Task:** viz-version-display-and-column-labels
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

1. No visible version indicator — can't tell which viz version is running
2. Queue column groups pending, ready, and rework tasks without visual distinction

## Design

### Versioning workflow

Create `viz/versions/v0.0.8/` by copying `v0.0.7/`. All changes in v0.0.8. LIAISON updates symlink after approval.

### Change A: Version display

Add a small version label in the page footer or header bar.

**Implementation:** Add a `<span>` with version text in the existing header area (near the title/controls). Style: subtle, small font, muted color. Example: `v0.0.8` in the top-right corner or next to the title.

```html
<span class="viz-version">v0.0.8</span>
```

```css
.viz-version {
  font-size: 0.75rem;
  color: #6b7280;
  opacity: 0.7;
}
```

### Change B: Queue column state sub-labels

Group tasks within the Queue column by their status, with visible section headers.

**Current:** Queue column renders all pending/ready/rework tasks in one flat list with only colored status dots.

**New:** Add sub-group headers within the Queue column:

```
QUEUE (15)
  ── ready (3) ──
  [task card]
  [task card]
  [task card]
  ── pending (11) ──
  [task card]
  ...
  ── rework (1) ──
  [task card]
```

**Implementation:** In the `renderKanbanColumns()` function, when rendering the queue column, group `columnNodes` by status and render a small header before each group. Sort groups: ready first (most actionable), then rework, then pending.

```javascript
// In queue column rendering:
const groups = {};
for (const node of columnNodes) {
  const s = node.status;
  if (!groups[s]) groups[s] = [];
  groups[s].push(node);
}
const groupOrder = ['ready', 'rework', 'pending'];
for (const status of groupOrder) {
  if (groups[status]?.length) {
    // Render sub-header
    html += `<div class="queue-group-header">${status} (${groups[status].length})</div>`;
    for (const node of groups[status]) {
      html += renderTaskCard(node);
    }
  }
}
```

```css
.queue-group-header {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #6b7280;
  padding: 4px 8px;
  margin-top: 8px;
  border-bottom: 1px solid #333;
  letter-spacing: 0.05em;
}
```

### Files Changed

1. `viz/versions/v0.0.8/index.html` — new version with both changes
2. `viz/versions/v0.0.8/changelog.json` — version metadata
3. `viz/versions/v0.0.8/server.js` — copy from v0.0.7 (no server changes needed)

### Testing

1. Version label visible in UI
2. Queue column shows grouped tasks by status with sub-headers
3. Sub-groups ordered: ready → rework → pending
4. Empty groups not shown
5. Other columns (Active, Review, Approved, Complete) unchanged
6. Light mode and dark mode both render correctly
