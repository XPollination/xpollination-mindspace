# Changelog: ms-a9-1-approval-requests

## v0.0.1 — Initial Design

- PDSA design for approval requests table + auto-creation on gated transition
- Migration: approval_requests with status CHECK (pending/approved/rejected)
- Auto-create on active→approval transition, return 202
- GET list/single at /api/projects/:slug/approvals
- 4 files: migration (NEW), approval-requests.ts (NEW), task-transitions.ts (UPDATE), projects.ts (UPDATE)
- 10 test cases
