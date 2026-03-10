# Changelog: wf-test-pass-gate v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- Gate placed in `validateDnaRequirements()` — no actor (including system) bypasses it
- `requiresDna: ['abstract_ref', 'test_pass_count', 'test_total_count']` on both task and bug `review->complete`
- Value validation (equality + positivity) added alongside existing GitHub link checks
- FIELD_VALIDATORS added for write-time type safety on both fields
- 2 files: workflow-engine.js (UPDATE), interface-cli.js (UPDATE)
- 19 test cases
