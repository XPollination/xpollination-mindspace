# PDSA: Fix Settings Page Bugs — Network Errors, Loading States

**Task:** ms-settings-page-bugs
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 bugfix

## Problem

Settings page HTML created but API endpoints it calls don't all exist or return wrong format. 4 bugs: change-password network error, API key stuck on Loading, sessions stuck on Loading, account info missing.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Verify /api/auth/change-password endpoint exists and accepts correct format | May be missing from wired routes or wrong request body |
| D2 | Verify API key endpoint exists, returns correct JSON for settings.html JS | May need /api/keys/me or similar |
| D3 | Verify sessions endpoint exists (GET /api/auth/sessions) | May not be wired in server.ts |
| D4 | Verify user info endpoint returns name/email for account section | May need /api/auth/me |
| D5 | Fix JS error handling: show error messages instead of infinite Loading | UX: never show Loading forever |
| D6 | Wire any missing endpoints into API server.ts | Root cause for 404s |

### Acceptance Criteria

- AC1: Change password form submits successfully (or shows clear error)
- AC2: API key section shows masked key (or "No key yet" + generate button)
- AC3: Sessions section shows active sessions (or "No sessions" message)
- AC4: Account section shows user name and email
- AC5: No infinite Loading states — all sections show content or error within 2s
- AC6: All API endpoints called by settings.html are wired and responding

### Files to Change

- `api/server.ts` — Wire missing auth endpoints
- `viz/versions/v0.0.X/settings.html` — Fix JS error handling
- `api/routes/auth.ts` or `api/routes/keys.ts` — Verify endpoints exist

### Test Plan

1. Open /settings → all sections load (no Loading stuck)
2. Change password → success message
3. API key → shows masked key or generate option
4. Sessions → shows list or empty state
5. Account → shows name + email

## Do / Study / Act

(To be completed)
