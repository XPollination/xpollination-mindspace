# PDSA: Viz Integration — Link Dashboard to Knowledge Browser

**Task:** `kb-viz-integration`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Dashboard (kanban, mission overview) and knowledge browser (document pages) are disconnected. Users can't click a mission name to read its documentation.

### Solution
Add clickable links between the two views. Dashboard → KB for documentation. KB → Dashboard for task management.

### Changes

#### 1. API: Include short_id in mission/capability responses

The `/api/mission-overview` response already returns mission and capability data. Add `short_id` to each object so the client can build KB links.

```javascript
// In mission-overview query, include short_id
SELECT m.*, m.short_id FROM missions m ...
SELECT c.*, c.short_id FROM capabilities c ...
```

#### 2. Dashboard → KB: Clickable names

In viz index.html (next version), wrap mission and capability names in anchor tags:

```javascript
// In mission card render (loadMissionDashboard or showMissionDetail)
// Before: <h3>${mission.title}</h3>
// After:  <h3><a href="/m/${mission.short_id}/${slugify(mission.title)}" target="_blank">${mission.title}</a></h3>

// In capability card render
// Before: <h3>${cap.title}</h3>
// After:  <h3><a href="/c/${cap.short_id}/${slugify(cap.title)}" target="_blank">${cap.title}</a></h3>
```

Use `target="_blank"` so KB opens in new tab — don't navigate away from dashboard.

#### 3. KB → Dashboard: "View Tasks" link

In knowledge browser pages, add a link back to the dashboard with a filter:

```html
<a href="/?view=mission&id=${missionId}">View Tasks in Dashboard →</a>
```

#### 4. CSS for links

```css
.kb-link { color: #58a6ff; text-decoration: none; font-size: 12px; opacity: 0.7; }
.kb-link:hover { opacity: 1; text-decoration: underline; }
```

Small, unobtrusive — doesn't change the dashboard visual weight.

### New Version

Create viz/versions/v0.0.36 (or next available) with these link changes. Keep v0.0.35 as rollback.

## Do

DEV:
1. Add `short_id` to mission-overview API response
2. Create new viz version with clickable links
3. Add "View Tasks" link in KB pages
4. Update active symlink

## Study

Verify:
- Mission name in dashboard is a link → opens KB page in new tab
- Capability name is a link → opens KB page
- KB page has "View Tasks" link → returns to dashboard
- No changes to existing dashboard functionality

## Act

### Design Decisions
1. **target="_blank"**: Open KB in new tab. Don't disrupt dashboard workflow.
2. **Subtle styling**: Links are unobtrusive — dashboard remains task-focused.
3. **Bidirectional**: Both directions linked. Dashboard ↔ KB.
4. **New version**: Don't modify v0.0.35 — rollback point preserved.
