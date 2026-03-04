# PDSA: Viz Complete Column Improvements — v0.0.1

## PLAN

### Problem

The COMPLETE column will accumulate many tasks over time. Currently:
1. No sorting — completed tasks appear in creation order (ASC)
2. Detail panel lacks timestamps (created_at, updated_at)
3. No time filter — all completed tasks shown

### Current State

- `server.js` returns `created_at` and `updated_at` per node (SQL query at line 78-79)
- `renderKanbanColumns()` filters nodes by status but does NOT sort within a column
- `showDetail()` shows title, slug, project, type, status, role, description, acceptance criteria, parents, children — but NO timestamps
- Complete column statuses: `['complete', 'completed', 'done']`

### Design

Three independent improvements:

#### 1. Sort Complete Column by Updated_at DESC

In `renderKanbanColumns()`, after filtering nodes for the complete column, sort by `updated_at` descending (newest first). Only sort the complete column — other columns keep creation order.

```javascript
// In renderKanbanColumns(), after filtering columnNodes:
if (col.id === 'complete') {
  columnNodes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}
```

~3 lines added to `renderKanbanColumns()`.

#### 2. Add Timestamps to Detail Panel

In `showDetail()`, add created_at and updated_at/completed_at after the Role field:

```javascript
// After role field in showDetail():
<div class="detail-field">
  <label>Created</label>
  <div class="value" style="font-size: 12px; color: #888;">${formatTimestamp(node.created_at)}</div>
</div>
<div class="detail-field">
  <label>Last Updated</label>
  <div class="value" style="font-size: 12px; color: #888;">${formatTimestamp(node.updated_at)}</div>
</div>
```

Add a helper function:
```javascript
function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts + 'Z'); // SQLite stores UTC without Z
  return d.toLocaleString();
}
```

~12 lines total.

#### 3. Time Filter for Complete Column

Add preset filter buttons above the complete column: **1d | 1w | 1m | All**

- Default: **1w** (1 week), persisted in localStorage
- Buttons styled similarly to blocked filter buttons (small, inline)
- Filter logic: compare `node.updated_at` against current time minus duration
- Count badge shows filtered/total: "COMPLETE (5/12)"

```javascript
// State
let completeTimeFilter = localStorage.getItem('viz-complete-filter') || '1w';

// Filter in renderKanbanColumns() for complete column:
const now = Date.now();
const FILTER_DURATIONS = {
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  'all': Infinity
};
const maxAge = FILTER_DURATIONS[completeTimeFilter] || FILTER_DURATIONS['1w'];
const filteredCompleteNodes = columnNodes.filter(n => {
  if (maxAge === Infinity) return true;
  const nodeTime = new Date(n.updated_at + 'Z').getTime();
  return (now - nodeTime) <= maxAge;
});
```

HTML for filter buttons (in column header):
```html
<div class="complete-time-filter">
  <button class="${completeTimeFilter === '1d' ? 'selected' : ''}" onclick="setCompleteFilter('1d')">1d</button>
  <button class="${completeTimeFilter === '1w' ? 'selected' : ''}" onclick="setCompleteFilter('1w')">1w</button>
  <button class="${completeTimeFilter === '1m' ? 'selected' : ''}" onclick="setCompleteFilter('1m')">1m</button>
  <button class="${completeTimeFilter === 'all' ? 'selected' : ''}" onclick="setCompleteFilter('all')">All</button>
</div>
```

~25 lines JS + ~10 lines CSS.

### UX Research Note

Preset duration buttons (1d/1w/1m/All) is the standard pattern for time filtering in project management and analytics tools (Jira, Linear, GitHub). Better than a date picker for this use case because:
- Quick — one click, no date entry
- Relative — always shows "last week" not a specific date range
- Mobile-friendly — buttons vs calendar widget

### Changes Required

1. **`viz/index.html`** (~50 lines total):
   - `renderKanbanColumns()`: Sort complete column by updated_at DESC (~3 lines)
   - `renderKanbanColumns()`: Time filter for complete column (~15 lines)
   - `showDetail()`: Add created_at and updated_at fields (~8 lines)
   - `formatTimestamp()` helper (~4 lines)
   - CSS: Time filter button styles (~10 lines)
   - HTML: Filter buttons in complete column header (~5 lines)
   - JS: `setCompleteFilter()` handler with localStorage (~5 lines)

2. **Versioned copy**: Update in new version directory, update active symlink

### What This Does NOT Do

- Does NOT change the complete column's status grouping (still matches 'complete', 'completed', 'done')
- Does NOT add sorting to other columns
- Does NOT add a date range picker (preset buttons are simpler and sufficient)
- Does NOT add pagination (filter reduces the set — pagination is a future concern)

### Acceptance Criteria

1. Complete column sorted by updated_at, newest first
2. Detail panel shows created_at and updated_at timestamps
3. Time filter buttons (1d/1w/1m/All) in complete column header
4. Default filter: 1 week, persisted in localStorage
5. Count badge shows filtered/total count
6. Card layout remains clean and readable

## DO

Implementation by DEV agent. ~50 lines in `viz/index.html`.

## STUDY

- Verify newest completed task appears at top of column
- Verify timestamps display correctly in detail panel
- Verify 1d/1w/1m/All filter buttons work
- Verify filter persists across page reload

## ACT

If approved: this becomes the standard complete column behavior.
