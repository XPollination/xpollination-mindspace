# Changelog: mission-map-landing-design v0.0.1

## v0.0.1 — 2026-03-20

Initial implementation.

### Changes
- renderMissionMap: 3-col responsive card grid with status badges
- getMissionOverview: data function for mission cards
- Root route `/` serves mission map, kanban at `/kanban`
- Deprecated missions dimmed below active group
- Footer stats (mission count, capability count)
- Card click navigates to /m/{short_id}

### Tests
- 13/13 passing
