# Changelog: ms-a1-6-google-oauth v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- passport + passport-google-oauth20 for OAuth2 flow
- Migration 005-users-oauth.sql: password_hash nullable, google_id UNIQUE (table rebuild)
- New routes file oauth.ts with GET /google and GET /google/callback
- Find-or-create by email: existing users get google_id linked, new users created without password
- JWT issued on callback, redirect to FRONTEND_URL with token in query
- Stateless (session: false) — JWT-only auth
- Conditional strategy registration (only if env vars present)
- 4 files: migration (NEW), routes (NEW), server.ts (UPDATE), package.json (UPDATE)
