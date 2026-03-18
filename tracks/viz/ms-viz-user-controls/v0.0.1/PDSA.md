# PDSA: Viz User Controls — Logout, Change Password, Project Names

**Task:** ms-viz-user-controls
**Version:** v0.0.1
**Status:** PLAN

## Problem

3 missing UI elements: no logout button, no change password page, project names showing as "local".

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Logout button in header/nav, calls /logout endpoint | Users need to log out |
| D2 | /settings page with change-password form → POST /api/auth/change-password | API exists, needs UI |
| D3 | Fix project names: verify API returns proper names from projects table | May be fallback issue from API discovery migration |
| D4 | Version bump for viz changes | Mandatory |

### Acceptance Criteria

- AC1: Logout button visible in Viz header
- AC2: Clicking logout clears session, redirects to login
- AC3: Change password page accessible from header/settings link
- AC4: Change password form validates current + new + confirm
- AC5: Projects dropdown shows real names (not "local")

### Files to Change

- `viz/versions/v0.0.X/index.html` — Logout button, settings link
- New: `viz/versions/v0.0.X/settings.html` — Change password page
- `viz/server.js` — Route for /settings page, check project name source

## Do / Study / Act

(To be completed)
