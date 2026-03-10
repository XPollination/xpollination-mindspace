# Changelog: pending-ready-design-gate v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Role-specific transition rule `pending->ready:dev` with `requiresDna: ['pdsa_ref']`
- Follows existing engine pattern for role-specific rules
- Only gates dev-role tasks — pdsa and liaison tasks pass through
- Bug type unaffected (bugs skip PDSA design by design)
- 1 file changed: workflow-engine.js
