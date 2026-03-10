# Changelog: ms-a4-2-req-versioning

## v0.0.1 — Initial Design

- PDSA design for requirement versioning
- Migration 015: requirement_versions table with UNIQUE(requirement_id, version)
- Auto-create snapshot version on every PUT (pre-update state)
- GET /:reqId/history endpoint with dual lookup
- change_summary optional field
- 2 files: migration (NEW), requirements.ts (UPDATE)
- 12 test cases
