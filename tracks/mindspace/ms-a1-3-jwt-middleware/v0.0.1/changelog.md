# Changelog: ms-a1-3-jwt-middleware v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- New middleware file `auth.ts` in existing `api/middleware/` directory
- Bearer token extraction from Authorization header
- jwt.verify with same JWT_SECRET env var as login endpoint
- Decoded payload attached to `req.user` with `sub` → `id` mapping
- Express Request type augmentation via `api/types/express.d.ts`
- Middleware exported as `requireAuth` (not applied to routes yet)
- 2 files: middleware (auth.ts), type augmentation (express.d.ts)
