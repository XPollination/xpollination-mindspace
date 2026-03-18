# PDSA: Bug — Settings Sessions Stuck on Loading

**Task:** ms-settings-sessions-loading | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Active Sessions section shows Loading... forever. Endpoint missing or returns wrong format.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Verify GET /api/auth/sessions endpoint exists and is wired | May be implemented but not mounted |
| D2 | If missing, implement: return active JWT sessions for authenticated user | Or show "No active sessions" placeholder |
| D3 | Fix JS error handling: show message on fetch failure, not Loading | No infinite Loading states |

### Acceptance Criteria
- AC1: Sessions section shows session list or "No sessions" message
- AC2: No infinite Loading state
- AC3: Sessions endpoint returns correct JSON format for JS to parse

### Files: `settings.html` JS, `api/routes/auth.ts`, `api/server.ts`
