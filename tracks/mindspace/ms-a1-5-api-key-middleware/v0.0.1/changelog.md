# Changelog: ms-a1-5-api-key-middleware v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- New middleware file `api-key-auth.ts` for API key verification
- X-API-Key header extraction (standard convention)
- SHA-256 hash-then-lookup against api_keys table
- Revoked keys (revoked_at set) return 401
- Falls through to JWT auth if no API key header
- Combined middleware `requireApiKeyOrJwt` chains both auth methods
- Same req.user shape as JWT middleware (id, email, name)
- 2 files: api-key-auth.ts, require-auth.ts
