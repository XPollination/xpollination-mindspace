# PDSA: Implement Mission State Badges + Backlog Indicators

**Task:** `mission-state-viz-impl`
**Version:** v0.0.1
**Status:** Design

## Plan

### What DEV Implements

Add mission state color badges and backlog task counts to viz/server.js. Two locations: (1) the `/api/mission-overview` response and (2) the `renderNodePage()` output for mission document pages.

### 1. MISSION_STATUS_COLORS Constant

Add at the top of viz/server.js (near existing constants):

```javascript
const MISSION_STATUS_COLORS = {
  draft:      '#9ca3af',  // gray
  ready:      '#3b82f6',  // blue
  active:     '#22c55e',  // green
  complete:   '#eab308',  // gold
  deprecated: '#6b7280',  // dim gray
  blocked:    '#ef4444',  // red
  cancelled:  '#ef4444',  // red
};
```

### 2. Update `/api/mission-overview` Query

**Current** (line ~611): Only queries `WHERE status = 'active'`

**Change to**: Query all non-deprecated missions, include status color:

```javascript
const missionRows = db.prepare(
  "SELECT id, slug, title, description, status, short_id FROM missions ORDER BY created_at ASC"
).all();
```

Add to each mission object in the response:

```javascript
missions.push({
  ...existing fields,
  status_color: MISSION_STATUS_COLORS[m.status] || '#9ca3af',
  backlog_count: backlogCount  // see step 3
});
```

### 3. Backlog Count per Mission

After fetching capabilities for a mission, count backlog tasks (tasks in non-terminal states: pending, ready, active, review, rework, blocked, approval, approved, testing):

```javascript
let backlogCount = 0;
for (const r of allReqsForMission) {
  try {
    backlogCount += db.prepare(
      "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type='task' AND status NOT IN ('complete','cancelled') AND dna_json LIKE '%' || ? || '%'"
    ).get(r.req_id_human).c;
  } catch (e) { /* skip */ }
}
```

The `allReqsForMission` is the combined list of requirements from all capabilities under the mission (already computed in the existing loop).

### 4. State Badge in renderNodePage()

In the `renderNodePage()` function, when `typePrefix === 'm'` (mission page), add a badge after the title:

```javascript
const statusBadge = typePrefix === 'm' && node.status
  ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${MISSION_STATUS_COLORS[node.status] || '#9ca3af'};margin-left:8px;vertical-align:middle;">${node.status}</span>`
  : '';
```

Insert in the HTML where the title is rendered:

```html
<h1>${title}${statusBadge}</h1>
```

### 5. Deprecated Dimming

For deprecated missions in the mission overview, the frontend (index.html dashboard) applies `opacity: 0.5` to the mission card. The API provides the status; the dashboard checks:

```javascript
// In dashboard mission card rendering (index.html)
const dimStyle = mission.status === 'deprecated' ? 'opacity:0.5;' : '';
```

### 6. Child Card Status Badges

In `renderNodePage()`, add small status indicators to child capability cards:

```javascript
${children.map(c => `
  <a href="/${childPrefix}/${c.short_id || c.id}" class="child-card">
    <h3>${c.title || c.req_id_human || c.id}
      ${c.status ? `<span style="font-size:10px;padding:1px 4px;border-radius:3px;background:${MISSION_STATUS_COLORS[c.status] || '#9ca3af'};color:#fff;margin-left:4px;">${c.status}</span>` : ''}
    </h3>
    <p>${(c.description || '').slice(0, 100)}${(c.description || '').length > 100 ? '...' : ''}</p>
  </a>
`).join('')}
```

### Files to Modify

| File | Change |
|------|--------|
| `viz/server.js` | Add MISSION_STATUS_COLORS, update mission-overview query, add badge to renderNodePage, add backlog count |

### Test Reference

Tests: `api/__tests__/mission-state-viz.test.ts` (from test task)
- MISSION_STATUS_COLORS mapping exists
- draft/active/complete color codes correct
- Backlog count reference

## Do

DEV:
1. Add `MISSION_STATUS_COLORS` constant to viz/server.js
2. Update `/api/mission-overview` to query all missions (not just active)
3. Add `status_color` and `backlog_count` to mission overview response
4. Add state badge to `renderNodePage()` for mission pages
5. Add status badges to child cards
6. Run tests: `npx vitest run api/__tests__/mission-state-viz`

## Study

Verify:
- `/api/mission-overview` returns `status_color` for each mission
- `/api/mission-overview` returns `backlog_count` for each mission
- Mission document pages show colored state badge next to title
- Child capability cards show status indicators
- Deprecated missions have dimming style data

## Act

### Design Decisions
1. **Inline styles for badges**: No CSS class additions needed. Keeps changes minimal in server.js.
2. **All missions, not just active**: Dashboard can filter client-side. API provides complete data.
3. **Backlog = non-terminal tasks**: Any task not complete/cancelled counts as backlog.
4. **Same color palette as design**: draft=gray, ready=blue, active=green, complete=gold, deprecated=dim, blocked/cancelled=red.
5. **No index.html changes**: Dashboard rendering uses API data. Badge colors come from API response.
