# PDSA: Google OAuth Activation

**Task:** ms-google-oauth-activation
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.12 Phase 3

## Problem

OAuth code exists (api/routes/oauth.ts, passport-google-oauth20) but no Google Cloud credentials configured. Need Cloud Console setup, env vars, and email-based account linking.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Create Google Cloud OAuth Client in Console | Required for OAuth flow |
| D2 | Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL in docker-compose | Runtime config via env vars |
| D3 | Callback URL: https://mindspace.xpollination.earth/api/auth/oauth/google/callback | HTTPS required (Phase 2 complete) |
| D4 | Account linking by email match (google_id in users table) | Thomas's email matches seeded admin |
| D5 | Verify thomas.pichler@xpollination.earth links to admin account | Critical — admin must retain privileges |

### Acceptance Criteria

- AC1: Google Cloud OAuth Client created
- AC2: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set in docker-compose
- AC3: GOOGLE_CALLBACK_URL points to HTTPS endpoint
- AC4: Login via Google redirects to Google consent screen
- AC5: After consent, user linked by email (google_id set in users table)
- AC6: Thomas's admin account links correctly via email match

### Files to Change

- `docker-compose.prod.yml` — Add Google OAuth env vars
- Google Cloud Console — Create OAuth Client (manual)

### Test Plan

1. Open https://mindspace.xpollination.earth/login → click "Login with Google"
2. Google consent screen appears → authorize
3. Redirect back → logged in as Thomas (admin)
4. Verify google_id set in users table
5. Login again → no consent prompt (already authorized)

## Do / Study / Act

(To be completed)
