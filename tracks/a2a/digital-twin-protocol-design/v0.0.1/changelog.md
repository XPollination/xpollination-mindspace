# Changelog: digital-twin-protocol-design v0.0.1

## v0.0.1 — 2026-03-20

Initial implementation.

### Changes
- 4 twin modules: mission, capability, requirement, task
- Each with create/validate/diff functions
- Submit helper for A2A message formatting (OBJECT_CREATE/OBJECT_UPDATE)
- Validation: composable {valid, errors[]} pattern
- Diff: field-level {old, new} tracking
- Task twin uses dot notation for nested DNA fields

### Tests
- 58/58 passing across 5 test files
