# Changelog: ms-a1-7-auth-tests v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- supertest for HTTP integration testing against Express app
- In-memory SQLite (DATABASE_PATH=:memory:) for isolated tests
- Test helper (api/test-helpers/setup.ts) runs all migrations
- Single test file (viz/ms-a1-7-auth-tests.test.ts) following existing naming
- 26 test cases covering: registration (5), login (4), JWT validation (4), API key lifecycle (6), combined middleware (2), token expiry (2), invalid credentials (3 across groups)
- Middleware tests use mock req/res for direct function testing
- HTTP tests use supertest against app export
- No OAuth integration tests (requires external Google APIs)
- 3 files: test helper (NEW), test file (NEW), package.json (UPDATE)
