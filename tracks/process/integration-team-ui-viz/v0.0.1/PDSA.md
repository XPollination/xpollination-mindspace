# PDSA: integration-team-ui-viz

## Plan

Replace tmux-based agent spawning in viz with runner-architecture UI calling Team Management API.

### Changes

**File:** `viz/versions/v0.0.38/js/agent-grid.js` (or current version)

Replace:
- Old "Start Agentic Team" button → new per-role add buttons + "Start Full Team" button
- Old `_spawnAgent()` tmux code → API calls to `/api/team/:project/*`

### New UI Components

1. **Per-role add buttons:** `+ LIAISON`, `+ PDSA`, `+ QA`, `+ DEV` — each calls `POST /api/team/:project/agent` with role
2. **Start Full Team button:** calls `POST /api/team/:project/full` — creates all 4 runners
3. **Runner cards:** grid showing each active runner with role, status (ready/busy/stopped), heartbeat
4. **Terminate button:** per-runner "X" button calls `DELETE /api/team/:project/agent/:id`
5. **Status indicators:** green=ready, yellow=busy, red=stopped, grey=draining

### API Integration (from integration-team-api)
```javascript
// Start full team
fetch(`/api/team/${project}/full`, { method: 'POST' })
// Add single runner
fetch(`/api/team/${project}/agent`, { method: 'POST', body: JSON.stringify({role}) })
// Terminate runner
fetch(`/api/team/${project}/agent/${id}`, { method: 'DELETE' })
// Get runner status
fetch(`/api/team/${project}/agent/${id}/status`)
```

### Acceptance Criteria
1. Per-role add buttons visible and functional
2. Start Full Team creates 4 runners
3. Runner cards show status in real-time (poll every 5s)
4. Terminate button stops runner
5. Old tmux spawn code removed from UI

### Dev Instructions
1. Update agent-grid.js: replace spawn button with role buttons
2. Add runner card rendering with status colors
3. Poll `/api/team/:project/runners` every 5s for status updates
4. Add terminate handler
5. Remove old `_spawnAgent()` tmux code
