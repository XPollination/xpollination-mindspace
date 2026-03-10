# Changelog: workflow-complete-role-reset v0.0.5

## v0.0.5 — 2026-03-10

Naming-only rework. Rename `v17/` to `v0.0.17/` on main to adopt the `v0.0.X` convention established on develop by the workflow-md-versioning task.

### Changes from v0.0.4
- Rename `tracks/process/context/workflow/v17/` → `v0.0.17/`
- Update symlink to point to `workflow/v0.0.17/WORKFLOW.md`
- Delete old `v17/` directory
- No enforcement code changes (all passing 19/19 tests)

## v0.0.4 — 2026-03-10

Full investigation of branch drift + enforcement design on main. Implementation committed (8b47c63). Rejected for versioning convention violation (v17 vs v0.0.17).

## v0.0.3 — 2026-03-10

Rejected: investigation only compared .js files, missed tracks structure drift.

## v0.0.2 — 2026-03-10

Enforcement design (EXPECTED_ROLES_BY_STATE + validateRoleConsistency). Rejected: branch drift not investigated.

## v0.0.1 — 2026-03-09

Initial safety-net design (silent correction). Rejected: must enforce, not correct.
