# Changelog: ms-a11-2-twin-schema v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Static JSON Schema (draft-07) inline in TypeScript, not a file on disk
- All 5 sections from §4.A2A.3: identity, role, project, state, metadata
- Strict validation: additionalProperties false, enums for constrained values
- Nullable fields via type arrays (["string", "null"])
- Public endpoint (no auth) — agents fetch before registration
- 2 files: new twin-schema.ts route, server.ts mount update
