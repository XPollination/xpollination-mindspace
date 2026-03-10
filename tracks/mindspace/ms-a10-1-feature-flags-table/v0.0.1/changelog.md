# Changelog: ms-a10-1-feature-flags-table

## v0.0.1 — Initial Design

- PDSA design for feature flags table + CRUD
- Migration 018: feature_flags with UNIQUE(project_slug, flag_name), 3 indexes
- States: off/on, human gate for toggling ON (admin only)
- POST/GET/PUT/DELETE with role-based access
- 3 files: 018-feature-flags.sql (NEW), feature-flags.ts (NEW), projects.ts (UPDATE)
- 16 test cases
