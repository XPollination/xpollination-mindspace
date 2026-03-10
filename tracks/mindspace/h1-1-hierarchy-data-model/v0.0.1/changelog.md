# Changelog: h1-1-hierarchy-data-model v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- UUID v4 for IDs (consistent with system patterns)
- Status CHECK constraints at DB level (missions: 4 values, capabilities: 5 values)
- dependency_ids as JSON TEXT array (SQLite limitation)
- Separate linking tables for capabilities↔requirements and capabilities↔tasks
- TEXT refs for requirements and tasks (cross-DB, no FK possible)
- ON DELETE CASCADE for clean data integrity
- 2 migration files: 002 (tables) + 003 (links)
- No CRUD endpoints — tables/migrations only per task scope
