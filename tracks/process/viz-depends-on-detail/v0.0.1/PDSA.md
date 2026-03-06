# PDSA: Viz depends_on in detail view + Queue filter toggles

**Task:** viz-depends-on-detail
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

1. Task detail panel doesn't show `depends_on` — can't see what blocks a task
2. Queue column has no filter toggles for pending/ready/rework states

## Design

Build as v0.0.9 (from v0.0.8 or whatever is current after viz-version-display-and-column-labels).

### Change A: depends_on in detail panel

Add a "Dependencies" section in the `showDetail()` function, after the existing Parents/Children sections.

**Implementation:** Read `dna.depends_on` array. For each slug, look up the node in the loaded `nodes` array to get its current status. Render as a list with status badges and clickable slugs.

```javascript
// In showDetail(), after children section:
const dependsOn = dna.depends_on || [];
const depNodes = dependsOn.map(slug => {
  const found = nodes.find(n => n.slug === slug);
  return { slug, node: found, status: found?.status || 'unknown' };
});

// Render:
${dependsOn.length > 0 ? `
<div class="detail-field">
  <label>Dependencies (${dependsOn.length})</label>
  <ul class="node-links">
    ${depNodes.map(d => `
      <li class="${d.node ? 'clickable' : ''}" ${d.node ? `data-id="${d.node.id}"` : ''}>
        <span class="badge status-${d.status}">${d.status}</span>
        ${d.node?.dna?.title || d.slug}
      </li>
    `).join('')}
  </ul>
</div>
` : ''}
```

If a dependency is `complete`, show green badge. If `pending`/`active`/etc, show appropriate color. If slug not found in loaded nodes, show "unknown" status (may be in a different project).

### Change B: Queue column filter toggles

Add filter buttons at the top of the Queue column, similar to the existing blocked/cancelled filter pattern.

**Implementation:** Add toggle buttons for `ready`, `pending`, `rework` at the top of the Queue column. When a filter is active, only show tasks matching that status. Default: show all.

```javascript
// Queue column header addition:
<div class="queue-filter-buttons">
  <button class="queue-filter-btn ${filter === 'all' ? 'active-filter' : ''}" data-filter="all">All</button>
  <button class="queue-filter-btn ${filter === 'ready' ? 'active-filter' : ''}" data-filter="ready">Ready</button>
  <button class="queue-filter-btn ${filter === 'pending' ? 'active-filter' : ''}" data-filter="pending">Pending</button>
  <button class="queue-filter-btn ${filter === 'rework' ? 'active-filter' : ''}" data-filter="rework">Rework</button>
</div>
```

Store filter state in `localStorage` for persistence. When a filter is selected, only render tasks matching that status in the Queue column.

### Files Changed

1. `viz/versions/v0.0.9/index.html` — both changes
2. `viz/versions/v0.0.9/changelog.json` — version metadata
3. `viz/versions/v0.0.9/server.js` — copy from previous (no server changes)

### Testing

1. Detail panel shows "Dependencies" section when depends_on is non-empty
2. Dependencies show status badge with correct color
3. Clickable dependencies navigate to that task's detail
4. Dependencies section hidden when depends_on is empty
5. Unknown slug (not in loaded nodes) shows "unknown" status gracefully
6. Queue filter buttons render (All, Ready, Pending, Rework)
7. Filter persists in localStorage
8. Filter "Ready" shows only ready tasks in Queue
9. Filter "All" shows all queue tasks (default)
