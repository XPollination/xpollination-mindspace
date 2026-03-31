# PDSA: kanban-blocked-cancelled-column

## Plan

Separate blocked/cancelled/rework from the Done column into their own columns.

### Current COLUMNS Config (kanban.js line 30-36)
```js
{ id: 'done', statuses: ['complete', 'rework', 'blocked', 'cancelled'] }
```

### New COLUMNS Config
```js
const COLUMNS = [
  { id: 'queue',    label: 'Queue',    statuses: ['pending', 'ready'],   color: 'var(--ms-status-ready)' },
  { id: 'active',   label: 'Active',   statuses: ['active', 'testing'],  color: 'var(--ms-status-active)' },
  { id: 'review',   label: 'Review',   statuses: ['review', 'approval'], color: 'var(--ms-status-review)' },
  { id: 'approved', label: 'Approved', statuses: ['approved'],           color: 'var(--ms-status-approved)' },
  { id: 'rework',   label: 'Rework',   statuses: ['rework'],             color: 'var(--ms-status-rework)' },
  { id: 'blocked',  label: 'Blocked',  statuses: ['blocked', 'cancelled'], color: 'var(--ms-status-blocked)' },
  { id: 'done',     label: 'Done',     statuses: ['complete'],           color: 'var(--ms-status-complete)' },
];
```

### Changes

1. **kanban.js COLUMNS** — split into 7 columns (was 5)
2. **Blocked card rendering** — show `dna.blocked_reason` if present
3. **Cancelled card rendering** — add `text-decoration: line-through` or muted opacity
4. **Filter toggle** — checkbox "Show blocked/cancelled" (default: checked). When unchecked, hide the blocked column. Store in `sessionStorage`.
5. **kanban.css** — ensure 7-column grid layout works, add blocked column distinct styling (orange border)

### File Changes

| File | Change |
|------|--------|
| `viz/versions/v0.0.38/js/kanban.js` | Update COLUMNS, add filter toggle logic, blocked_reason rendering |
| `viz/versions/v0.0.38/kanban.css` | 7-column grid, blocked column color, cancelled strikethrough |
| `viz/versions/v0.0.38/kanban.html` | Add filter toggle checkbox |

### Dev Instructions
1. Update COLUMNS in kanban.js
2. Add blocked_reason display in card rendering function
3. Add cancelled visual treatment (opacity + strikethrough)
4. Add filter toggle checkbox in header
5. Store toggle state in sessionStorage
6. Adjust CSS grid for 7 columns
7. Test with tasks in blocked/cancelled/rework states
8. Git add, commit, push

### What NOT To Do
- Do NOT change the A2A query (blocked/cancelled already returned)
- Do NOT add drag-and-drop between columns
- Do NOT add transition buttons in blocked column
