# PDSA: Mission-Grouped Hierarchy View with Progressive Drill-Down

**Task:** `viz-hierarchy-progressive-drilldown`
**Version:** v0.0.1
**Status:** Design

## Plan

Replace the flat capability list with a 3-level progressive drill-down: Mission → Capability → Requirement+Tasks.

### Level 0: Mission Overview (default when Mission view toggled)

3 mission cards replacing the current flat capability grid:

```
┌─────────────────────────────────┐
│ 🎯 Fair Attribution             │
│ Measurable collaboration...     │
│ 2 capabilities | ████████░░ 75% │
│ ■ green                         │
└─────────────────────────────────┘
```

Each card shows:
- Mission title + WHY description (truncated)
- Capability count
- Aggregate progress bar (complete_tasks / total_tasks across all capabilities)
- Health color: green (>80%), yellow (>50%), red (<50%)

### Level 1: Capability View (after clicking a mission)

Breadcrumb: `Mindspace > Fair Attribution`

Capability cards for that mission:

```
┌─────────────────────────────────┐
│ CAP-AUTH                        │
│ Authentication, access control  │
│ 2 requirements | ████████░ 83%  │
│ ■ green                         │
└─────────────────────────────────┘
```

### Level 2: Requirement + Tasks (after clicking a capability)

Breadcrumb: `Mindspace > Fair Attribution > CAP-AUTH`

Requirements listed with implementing tasks:

```
REQ-AUTH-001: User Login
  ✅ ms-auth-e2e-design (complete)
  ✅ ms-auth-seed-cleanup (complete)
  🔵 ms-auth-session-refresh (active)

REQ-AUTH-002: Invite Management
  ✅ ms-invite-flow (complete)
```

Task status badges: ✅ complete, 🔵 active, ⚪ pending, 🔴 blocked

### Client-Side Changes (index.html)

1. **Replace `loadMissionDashboard()`**: Fetch `/api/mission-overview`, render mission cards
2. **Add `showMissionDetail(missionId)`**: Fetch capabilities for that mission, render capability cards
3. **Update `showCapabilityDetail(capId)`**: Fetch `/api/capabilities/:capId/requirements`, render requirement+task list
4. **Breadcrumb**: Use existing `navStack` + `renderBreadcrumb()`, extend with mission level
5. **Health colors**: CSS classes `.health-green`, `.health-yellow`, `.health-red`
6. **Progress bars**: CSS flexbox with filled/empty segments

### CSS Additions

```css
.mission-card { padding: 16px; background: #1a1e2e; border-radius: 8px; cursor: pointer; }
.mission-card:hover { border-color: #e94560; }
.progress-bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; }
.health-green .progress-fill { background: #22c55e; }
.health-yellow .progress-fill { background: #eab308; }
.health-red .progress-fill { background: #ef4444; }
.status-complete { color: #22c55e; }
.status-active { color: #3b82f6; }
.status-pending { color: #6b7280; }
.status-blocked { color: #ef4444; }
```

### Data Dependencies

Requires `viz-hierarchy-data-layer` to be complete first — the API endpoints must return correct data before the UI can render it.

## Do

DEV modifies viz/versions/v0.0.34/index.html:
1. Replace `loadMissionDashboard()` with mission card grid
2. Add `showMissionDetail()` handler
3. Update `showCapabilityDetail()` for requirement+task view
4. Extend breadcrumb with mission level
5. Add health color CSS
6. Add progress bar CSS

## Study

Verify (browser test by Thomas):
- 3 mission cards visible on Mission view toggle
- Click mission → capability cards
- Click capability → requirements with tasks
- Breadcrumb navigates back at every level
- Health colors reflect actual progress
- Task counts match reality

## Act

### Design Decisions
1. **Progressive disclosure**: Summary first, detail on click. No overwhelming data dumps.
2. **Reuse existing patterns**: navStack, renderBreadcrumb already work. Extend, don't rewrite.
3. **Health thresholds**: 80%/50% match common industry standards.
4. **No emoji in actual CSS**: Use color-coded circles/dots, not emoji. Emoji shown in PDSA for readability.
5. **Mobile-friendly**: Cards use CSS grid that stacks on narrow viewports.
