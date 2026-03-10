# Changelog: ms-a14-2-marketplace-requests

## v0.0.1 — Initial Design

- PDSA design for marketplace requests table + CRUD
- Migration 020: marketplace_requests with category/status CHECK, 3 indexes
- Cross-project endpoint at /api/marketplace/requests
- Statuses: open/matched/fulfilled/closed
- 3 files: migration (NEW), marketplace-requests.ts (NEW), server.ts (UPDATE)
- 14 test cases
