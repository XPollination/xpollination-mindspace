# PDSA: Mission Map as Landing Page

**Task:** mission-map-landing-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-VKF-001

## Problem

The viz landing page (`/`) currently serves the Kanban board (`index.html`), which is a task-management view. The Knowledge Browser should present a knowledge-first view: mission cards showing the project's structure, not its task backlog.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **New route `/` serves mission map, kanban moves to `/kanban`** | Knowledge-first UX. Task board is operational, not the entry point for understanding the project. Redirect `/kanban` link in header or nav. |
| D2 | **Card click navigates to `/m/{short_id}`** | Reuses existing KB drill-down pages. No inline expansion needed — the document pages already work well. |
| D3 | **Mission map is server-rendered HTML** (like KB pages) | Consistent with existing renderNodePage pattern. No SPA framework needed. |
| D4 | **Data from existing `/api/mission-overview` endpoint** | Already provides missions with nested capabilities, descriptions, status, cap counts. No new API needed. |
| D5 | **Active missions first, deprecated missions dimmed below** | Active work should be prominent. Deprecated missions preserved for reference but visually de-emphasized. |
| D6 | **3-column card grid, responsive to 2-col and 1-col** | Based on wireframe (05-viz-knowledge-first.svg). 3 cards fits 900px+, stacks on mobile. |
| D7 | **Status-colored top border per card** | Visual differentiation: active=green, draft=blue, complete=gray. Matches wireframe style. |

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Mindspace logo]    [Search...]    [Knowledge] [Tasks]  │  ← existing header
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Active Missions                                        │
│  3 missions driving current work                        │
│                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬ │    │ ← colored border
│  │ Title         │ │ Title         │ │ Title         │    │
│  │ First para... │ │ First para... │ │ First para... │    │
│  │ [4 caps] [✓]  │ │ [3 caps] [✓]  │ │ [2 caps] [~]  │    │ ← badges
│  │ Click → /m/id │ │ Click → /m/id │ │ Click → /m/id │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                         │
│  ─────────────────────────────────────────────          │
│  Deprecated Missions                                    │
│  ○ Agent-Human Collab  ○ Traversable Context  ○ ...    │ ← dimmed, single line
│                                                         │
│  ─────────────────────────────────────────────          │
│  3 active · 5 deprecated · 9 capabilities              │ ← footer stats
└─────────────────────────────────────────────────────────┘
```

### Card Structure

Each mission card contains:
1. **Colored top bar** (8px): status color (active=`#48bb78`, draft=`#4299e1`, complete=`#a0aec0`)
2. **Title** (bold, 14px): mission title
3. **Description excerpt**: first 120 chars of description or content_md
4. **Badges row**:
   - Capability count badge: `[N caps]` with blue border
   - Status badge: status text with status-colored background
   - Progress: `N/M tasks done` if task data available
5. **Link**: entire card is clickable → `/m/{short_id}`

### Status Colors

| Status | Border | Badge BG | Badge Text |
|--------|--------|----------|------------|
| active | `#48bb78` (green) | `#f0fff4` | `#276749` |
| draft | `#4299e1` (blue) | `#ebf8ff` | `#2b6cb0` |
| complete | `#a0aec0` (gray) | `#f7fafc` | `#4a5568` |
| cancelled | `#fc8181` (red) | `#fff5f5` | `#c53030` |

### Deprecated Section

- Gray background band (`#f7fafc`)
- Inline list: mission titles separated by `·`
- Each title links to `/m/{short_id}`
- Text color: `#a0aec0` (dimmed)

### Footer Stats

- Format: `N active · N deprecated · N capabilities`
- Computed from mission-overview data
- Centered, small text (`#718096`, 11px)

### Server Implementation Notes

In `viz/server.js`, add handler before the static file fallback:

```javascript
// Mission Map landing page (root route)
if (pathname === '/') {
  const overview = await getMissionOverview(db);
  const html = renderMissionMap(overview);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
  return;
}
```

The `renderMissionMap()` function:
1. Calls `/api/mission-overview` internally (or queries DB directly)
2. Separates active vs deprecated missions
3. Generates card HTML with status colors
4. Uses same CSS variables and dark/light theme as KB pages

### Acceptance Criteria

- AC1: `/` shows mission map with active mission cards
- AC2: Each card shows title, description excerpt, cap count, status badge
- AC3: Card click navigates to `/m/{short_id}`
- AC4: Deprecated missions shown dimmed below active missions
- AC5: Footer shows mission/capability stats
- AC6: Responsive: 3-col → 2-col → 1-col
- AC7: Dark/light theme compatible (same CSS vars as KB pages)
- AC8: Kanban board accessible at `/kanban` (moved from `/`)

### Test Plan

Tests go in `api/__tests__/mission-map-landing.test.ts`:
- Mission map HTML contains card elements for each active mission
- Deprecated missions rendered separately (dimmed)
- Card links use `/m/{short_id}` URLs
- Status badge colors match status
- Footer stats are computed correctly
- Kanban redirect works (`/` → map, old kanban at `/kanban`)

## Do / Study / Act

*(To be filled after implementation)*
