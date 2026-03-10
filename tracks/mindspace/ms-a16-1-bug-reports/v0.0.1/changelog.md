# Changelog: ms-a16-1-bug-reports

## v0.0.1 — Initial Design

- PDSA design for bug reports table + submission endpoint
- Migration 021: bug_reports with severity/status CHECK, 3 indexes
- POST/GET/PUT at /api/projects/:slug/bugs
- Viewer can submit, contributor can update status
- No DELETE — bugs are closed for audit trail
- 3 files: migration (NEW), bug-reports.ts (NEW), projects.ts (UPDATE)
- 14 test cases
