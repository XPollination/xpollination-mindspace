# Changelog: ms-a1-2-login-jwt v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Login endpoint added to existing auth.ts (same router)
- jsonwebtoken package for JWT signing
- JWT payload: sub (user_id), email, name
- JWT_SECRET from environment (required), JWT_EXPIRY configurable (default 24h)
- 401 for both "user not found" and "wrong password" (prevents enumeration)
- Response includes token + user object (no password_hash)
- 2 files changed: auth.ts (update), package.json (update)
