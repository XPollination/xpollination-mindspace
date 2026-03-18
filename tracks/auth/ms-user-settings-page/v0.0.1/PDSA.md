# PDSA: Viz Settings Page — Password, API Key, Sessions

**Task:** ms-user-settings-page
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-003 short-term

## Problem

No self-service settings page. Users can't change password, view API keys, or manage sessions from the UI.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | /settings route serves settings.html | Dedicated page |
| D2 | Change password form: current + new + confirm → POST /api/auth/change-password | API exists |
| D3 | API key display: masked, click to reveal. Regenerate button | Robin needs API key for agent config |
| D4 | Active sessions list with revoke button | Session management from ms-auth-user-journey |
| D5 | User info: name, email, role | Context |
| D6 | OAuth-only users: hide change-password, show "Set Password" | No existing password to verify |
| D7 | /settings in PUBLIC_PATHS (auth handled by page itself) | Serves own auth-gated content |

### Acceptance Criteria

- AC1: /settings page accessible from header link
- AC2: Change password form works (validates, submits, shows success/error)
- AC3: API key visible (masked), revealable, regeneratable
- AC4: Active sessions listed, revocable
- AC5: OAuth-only users see "Set Password" instead of "Change Password"
- AC6: Consistent styling with login/register pages

### Files to Create/Change

- New: `viz/versions/v0.0.X/settings.html`
- `viz/server.js` — /settings route

## Do / Study / Act

(To be completed)
