# Changelog: ms-a2-5-seed-data

## v0.0.1 — Initial Design

- PDSA design for seed data script
- Seed script (not migration): api/db/seed.ts
- 3 admin users (Thomas, Robin, Maria) with is_system_admin=1
- 2 projects (xpollination-mcp-server, pichler-mindspace)
- 6 project_access entries (3 users × 2 projects, all admin)
- API key generation per user (logged to stdout)
- Idempotent via INSERT OR IGNORE
- 1 file: seed.ts (NEW)
- 10 test cases
