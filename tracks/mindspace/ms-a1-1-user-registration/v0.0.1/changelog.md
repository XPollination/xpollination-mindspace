# Changelog: ms-a1-1-user-registration v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- bcryptjs (pure JS) with cost factor 12 for password hashing
- UUID v4 for user IDs (crypto.randomUUID)
- SQL migration file following ms-a0-7-migrations pattern
- Email uniqueness at DB level (UNIQUE constraint + index)
- Basic input validation: email regex, 8-char min password, required fields
- Response excludes password_hash
- 4 files: migration, auth route, server mount, package.json dependency
