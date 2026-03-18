# PDSA: Bug — Catch-All Proxy Intercepts Viz-Owned Routes

**Task:** ms-viz-data-proxy-conflict | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Catch-all proxy forwards ALL /api/* to Express API (3100), including /api/data which Viz handles itself (reads xpollination.db with 400+ tasks). Express API has 0 tasks → project view shows nothing.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Exclude Viz-owned routes from catch-all proxy | /api/data, /api/projects, /api/version, /api/changelogs, /api/mission-overview, /api/settings, /api/node |
| D2 | Only proxy routes Viz does NOT handle | /api/auth/*, /a2a/*, /api/keys, /api/agents, etc. |
| D3 | Whitelist approach: explicitly list routes TO proxy, not routes to exclude | Safer — new Viz routes won't accidentally get proxied |

### Acceptance Criteria
- AC1: /api/data handled by Viz (returns 400+ tasks)
- AC2: /api/auth/* proxied to Express API
- AC3: Individual project filter shows tasks
- AC4: No regression on auth endpoints

### Files: `viz/server.js` — Fix catch-all proxy route ordering
