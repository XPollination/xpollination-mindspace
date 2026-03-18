# PDSA: Admin Password Reset CLI

**Task:** ms-auth-admin-password-reset
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.6

## Problem

No email sending until post-ROAD-001. If a test group user (Maria/Robin/Katharina) forgets their password, there's no recovery path. Need a CLI tool Thomas can run on the server to reset passwords.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Create `api/scripts/reset-password.js` CLI script | Server-side only — no API endpoint (that would need email verification) |
| D2 | Usage: `node api/scripts/reset-password.js <email> <new-password>` | Simple, minimal interface |
| D3 | bcrypt hash with 12 salt rounds (same as seed.ts) | Consistent with existing auth implementation |
| D4 | Verify email exists before updating | Prevent silent failures on typos |
| D5 | Log reset action (timestamp, email) to stdout | Audit trail without additional infrastructure |

### Acceptance Criteria

- AC1: Script updates password_hash in users table for given email
- AC2: Script rejects if email not found in database
- AC3: Script uses bcrypt with 12 salt rounds
- AC4: Script logs success/failure to stdout
- AC5: Script has no API exposure (file-only access)
- AC6: Works with the auth database (same connection as seed.ts)

### Files to Create

- `api/scripts/reset-password.js` — CLI password reset tool

### Test Plan

1. Reset password for known user → verify login works with new password
2. Attempt reset for non-existent email → verify error message
3. Verify bcrypt hash format matches existing auth flow

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
