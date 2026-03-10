# Changelog: ms-a1-4-api-key-gen v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- crypto.randomBytes(30) for key generation, hex-encoded with `xpo_` prefix (64 chars total)
- SHA-256 hash for storage (fast, deterministic, suitable for high-entropy keys)
- Key shown once on creation, only hash stored after
- Soft-delete via revoked_at (preserves audit trail)
- Separate routes file (keys.ts) mounted at /api/keys
- ON DELETE CASCADE from users
- 3 files: migration (004-api-keys.sql), routes (keys.ts), server mount (server.ts update)
