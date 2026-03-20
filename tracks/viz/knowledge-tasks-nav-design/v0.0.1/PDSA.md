# PDSA: Knowledge/Tasks/Releases Tab Navigation

**Task:** knowledge-tasks-nav-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-VKF-002

## Problem

Viz has mission map (/) and kanban (/kanban) but no unified navigation between knowledge, tasks, and releases views.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Client-side tab switching with history.pushState | No page reload. Fast switching. Browser back works. |
| D2 | Preserve kanban scroll via dataset attribute | Store scrollTop on tab-out, restore on tab-in. Lightweight. |
| D3 | Three tabs: Knowledge (default), Tasks, Releases | Maps to three views: mission map/KB, kanban, release manager. |

### Tab Layout

Header right side: `[Knowledge] [Tasks] [Releases]` with active tab highlighted.

Routes: `/` (Knowledge), `/tasks` (Tasks/Kanban), `/releases` (Release Manager)

### State Preservation

Each tab's content div is hidden (display:none) not destroyed. Scroll position stored in data-scroll attribute. On tab switch: save current scroll → hide current → show target → restore target scroll.

### Acceptance Criteria

- AC1: Three tabs visible in header
- AC2: Tab click switches view without page reload
- AC3: Active tab visually highlighted
- AC4: Kanban scroll position preserved across tab switches
- AC5: Browser back/forward navigates tabs
- AC6: Deep links work (/tasks, /releases)

### Test Plan

api/__tests__/knowledge-tasks-nav.test.ts
