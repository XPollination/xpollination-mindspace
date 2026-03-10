# Changelog: ms-a0-7-migrations v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- SQL file-based migrations (not TypeScript) per requirement
- Numeric prefix filename ordering (001_, 002_, etc.)
- SHA-256 checksum tracking — detects modified applied migrations
- Transaction per migration — fail-fast, no partial applies
- Explicit `npm run api:migrate` — NOT auto-run on server start
- 3 files: migrate.ts runner, migrations/.gitkeep, package.json script
