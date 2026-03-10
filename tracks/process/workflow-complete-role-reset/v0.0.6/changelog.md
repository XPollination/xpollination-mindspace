# Changelog: workflow-complete-role-reset v0.0.6

## v0.0.6 — 2026-03-10

Pattern consistency cleanup.

### Changes
- Remove stale v16/ directory from main (superseded by v0.0.17/)
- Result: only v0.0.X directories exist under workflow/
- Historical PDSA docs referencing v16 left unchanged (accurate records)
- QA tests need updating: workflow-md-versioning.test.ts → check v0.0.17/ not v16/
