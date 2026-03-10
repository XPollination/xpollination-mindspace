# Changelog: ms-a13-1-org-brain-collection v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Endpoint on Mindspace API (port 3100), calls Qdrant directly via @qdrant/js-client-rest
- Collection name: brain_org_{project_slug}
- Vector config: 384 dims, Cosine (matches existing brain collections)
- Same payload indexes as thought_space (11 fields across keyword/integer/float/datetime)
- Idempotent: returns 200 if already provisioned
- Migration 009 adds has_org_brain + org_brain_collection columns to projects
- POST /provision creates collection + indexes + updates DB
- GET / returns brain status
- 4 files: migration (NEW), routes (NEW), server.ts (UPDATE), package.json (UPDATE)
- 19 test cases
