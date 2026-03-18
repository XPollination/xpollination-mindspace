# PDSA: Complete Auth User Journey

**Task:** ms-auth-user-journey
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.6

## Problem

Current auth has basic login/register but lacks 2026 best-practice features: password change, rate limiting, session management, CSRF, account deletion. These are needed before opening to test group.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | POST /api/auth/change-password — requires current + new password | Standard authenticated password change, prevents unauthorized changes |
| D2 | Rate limiting on /api/auth/login — express-rate-limit, 5 attempts/15min/IP | Prevents brute force attacks |
| D3 | Session tracking in DB — sessions table with token hash, user_id, created_at, last_used, revoked | Enables session listing and revocation |
| D4 | JWT refresh tokens — 15min access + 7d refresh, rotation on refresh | Short-lived access reduces window of exposure |
| D5 | DELETE /api/auth/account — GDPR compliance, cascading cleanup | Required for EU compliance; delete user data, sessions, API keys |
| D6 | Password strength — uppercase + lowercase + number + 8 char minimum | Beyond simple length check |
| D7 | CSRF protection — SameSite=Strict + Origin header check | Double-submit cookie is complex; SameSite+Origin is simpler and sufficient for same-origin API |
| D8 | OUT OF SCOPE: email sending (forgot password, verification) | Requires SMTP setup, deferred post-ROAD-001 |

### Acceptance Criteria

- AC1: POST /api/auth/change-password validates current password before accepting new
- AC2: Login rate limited to 5 attempts per 15 min per IP
- AC3: GET /api/auth/sessions lists active sessions for authenticated user
- AC4: DELETE /api/auth/sessions/:id revokes specific session
- AC5: Refresh token endpoint issues new access + refresh token pair
- AC6: DELETE /api/auth/account removes user and cascading data
- AC7: Password validation enforces uppercase + lowercase + number + 8 chars
- AC8: CSRF: API rejects cross-origin requests without valid Origin header

### Files to Change

- `api/routes/auth.ts` — Add new endpoints (change-password, sessions, account deletion)
- `api/middleware/` — Rate limiting middleware, CSRF middleware
- `api/db/` — Sessions table schema, migration
- `src/db/schema.sql` — Add sessions table

### Test Plan

1. Change password with correct current → success
2. Change password with wrong current → 401
3. Login 6 times rapidly → 429 on 6th attempt
4. List sessions → shows current session
5. Revoke session → that token stops working
6. Refresh token → new access token, old refresh invalidated
7. Delete account → all user data gone, login fails
8. Weak password → rejected with clear message
9. Cross-origin request without Origin → rejected

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
