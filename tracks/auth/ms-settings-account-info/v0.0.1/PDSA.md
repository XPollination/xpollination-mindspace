# PDSA: Bug — Settings Account Info Missing

**Task:** ms-settings-account-info | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Account section shows "Signed in as..." without name/email. User info endpoint missing or fails silently.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Implement GET /api/auth/me returning {id, name, email, is_system_admin} | Standard user profile endpoint |
| D2 | settings.html JS fetches /api/auth/me on load, populates account section | Shows user identity |
| D3 | Fallback: decode JWT client-side for name/email if endpoint fails | Graceful degradation |

### Acceptance Criteria
- AC1: Account section shows user name and email
- AC2: GET /api/auth/me returns authenticated user profile
- AC3: Fallback shows "Unknown" instead of empty

### Files: `settings.html` JS, `api/routes/auth.ts`
