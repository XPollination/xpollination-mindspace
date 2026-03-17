# PDSA: Bug — Settings Router Not Mounted + Proxy Intercepts

**Task:** ms-settings-api-mount-bug | **Version:** v0.0.1 | **Status:** PLAN

## Problem
settings.ts router exists but not mounted in server.ts (404). Catch-all proxy intercepts Viz settings handler.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Mount settings router in api/server.ts | Fix 404, enable per-user scoped settings |
| D2 | Catch-all proxy forwards to API correctly (settings now responds) | No interception issue once mounted |
| D3 | Viz settings handler becomes backward compat fallback | Smooth transition |

### Acceptance Criteria
- AC1: /api/settings/liaison-approval-mode returns scoped setting via API
- AC2: PUT /api/settings/liaison-approval-mode saves per-user per-project
- AC3: No 404 on settings endpoints

### Files: `api/server.ts` — mount settingsRouter
