# PDSA: Viz Agent Bar — Read from A2A Agents Table

**Task:** ms-viz-agent-bar-api
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.20 Phase 7.1

## Problem

Viz agent status bar reads from local stations table. Needs to read from agents table (A2A) to show remote agents (e.g., Robin's LIAISON on his server).

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Viz fetches /api/agents/pool (agent-pool.ts exists) | Replace stations table with A2A agents |
| D2 | Render agent cards: role, name, owner, status, current task | Rich agent visibility |
| D3 | agents table fields: id, name, current_role, status, session_id, connected_at, last_seen, user_id | Source data from A2A connect |
| D4 | Version bump for viz changes | Mandatory |

### Acceptance Criteria

- AC1: Agent bar fetches from /api/agents/pool, not stations
- AC2: Remote agents visible (connected via A2A)
- AC3: Agent cards show role, name, status, current task
- AC4: Stale agents (last_seen > 5 min) shown as inactive

### Files to Change

- `viz/versions/v0.0.X/index.html` — renderAgentStatusBar reads from API
- `viz/server.js` — Proxy /api/agents/pool to API
- `api/routes/agent-pool.ts` — Verify endpoint returns needed fields

## Do / Study / Act

(To be completed)
