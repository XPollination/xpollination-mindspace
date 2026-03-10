# Changelog: ms-a14-1-marketplace-announcements

## v0.0.1 — Initial Design

- PDSA design for marketplace announcements table + CRUD
- Migration 019: marketplace_announcements with category/status CHECK, 3 indexes
- Cross-project endpoint at /api/marketplace/announcements
- Admin-only create/update for announcing project
- No DELETE — use status:withdrawn for audit trail
- 3 files: migration (NEW), marketplace-announcements.ts (NEW), server.ts (UPDATE)
- 14 test cases
