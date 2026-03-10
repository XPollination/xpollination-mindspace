# Changelog: ms-a2-4-system-admin

## v0.0.1 — Initial Design

- PDSA design for system admin bypass
- Migration 011: ALTER TABLE users ADD COLUMN is_system_admin INTEGER DEFAULT 0
- Modify requireProjectAccess middleware: admin bypass before access check
- Admin still gets 404 for non-existent projects
- req.projectAccess includes is_system_admin: true for admin users
- 2 files: 011-system-admin.sql (NEW), require-project-access.ts (UPDATE)
- 12 test cases
