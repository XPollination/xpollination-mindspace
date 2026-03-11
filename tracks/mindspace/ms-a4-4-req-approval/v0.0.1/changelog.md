# Changelog: ms-a4-4-req-approval

## v0.0.1 — Initial Design

- PDSA design for requirement approval workflow
- Migration 023: requirement_approvals with time-bonded tokens (1h TTL)
- POST request + POST confirm endpoints
- draft→active on confirmation, records version history
- 3 files: migration (NEW), requirement-approvals.ts (NEW), requirements.ts (UPDATE)
- 12 test cases
