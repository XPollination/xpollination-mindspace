# Completion Abstract: Mission Map as Landing Page

**Task:** mission-map-landing-design
**Status:** complete
**Date:** 2026-03-20
**Author:** LIAISON

## Outcome
Mission map replaces kanban as the root route. 3-column responsive card grid with status-colored borders, description excerpts, capability count badges. Deprecated missions dimmed below active ones. Kanban preserved at /kanban.

## Changes Made
- `viz/server.js`: renderMissionMap function, getMissionOverview data function
- Root route `/` serves mission map, kanban moved to `/kanban`
- Status badges with colored borders, deprecated section, footer stats

## Key Decisions
- Server-rendered HTML consistent with KB pages (D3)
- Card click navigates to /m/{short_id} (D2)
- Uses existing /api/mission-overview endpoint (D4)

## Learnings
- Mission map provides a more intuitive entry point than the kanban board for users exploring the project structure
