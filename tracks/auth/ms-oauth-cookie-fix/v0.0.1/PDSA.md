# PDSA: Fix Google OAuth — SameSite, Redirect, Invite-Only

**Task:** ms-oauth-cookie-fix
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 bugfix

## Problem

3 bugs prevent Google OAuth from working: (1) SameSite=strict blocks cookie on OAuth redirect, (2) res.redirect('/') goes to API port 3100 not Viz, (3) OAuth bypasses invite-only system.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Change SameSite=strict to SameSite=lax | Lax allows cookies on top-level navigations (OAuth redirect), strict blocks them |
| D2 | Set FRONTEND_URL env var, redirect to it after OAuth | Fix redirect going to API port instead of Viz |
| D3 | OAuth only allows existing users (already registered via invite) | Enforces invite-only: no user creation without invite code |
| D4 | If email not found, redirect to /login with error message | Clear feedback: "register with invite code first" |

### Acceptance Criteria

- AC1: SameSite=lax on ms_session cookie in oauth.ts
- AC2: FRONTEND_URL set in docker-compose, redirect uses it
- AC3: OAuth callback rejects unknown emails (not in users table)
- AC4: Existing user with matching email gets google_id linked
- AC5: Error redirect includes message for unknown users
- AC6: Thomas can login via Google OAuth end-to-end

### Files to Change

- `api/routes/oauth.ts` — SameSite fix, existing-user-only gate, redirect URL
- `docker-compose.prod.yml` — Add FRONTEND_URL env var

### Test Plan

1. Login via Google → cookie set, redirect to Viz dashboard
2. New Google email (not registered) → redirect to login with error
3. Verify SameSite=lax in Set-Cookie header
4. Verify redirect goes to FRONTEND_URL, not API port

## Do / Study / Act

(To be completed)
