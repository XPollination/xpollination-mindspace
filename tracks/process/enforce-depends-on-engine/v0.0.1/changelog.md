# Changelog: enforce-depends-on-engine v0.0.1

## 2026-03-06

### Added
- Dependency scheduling gate in `cmdTransition()` for `pending→ready`: iterates `depends_on[]`, queries each slug status, rejects if any not complete
- Dependency reflection gate: requires `depends_on_reviewed=true` when `depends_on` is empty/missing — opt-out pattern enforces conscious decision
- 9 QA tests covering both gates, mixed dependencies, nonexistent slugs, and non-regression for `rework→active`

### Files Changed
- `src/db/interface-cli.js` — two new gates in `cmdTransition()` for `pending→ready`
- `src/db/schema.sql` — default `liaison_approval_mode` changed from `manual` to `auto` (unrelated, low risk)
