# PDSA: Systemic Version Management (CMM4)

**Task:** ms-version-management-systemic | **Version:** v0.0.1 | **Status:** PLAN

## Problem
version-bump.sh copies directories but doesn't update changelog.json inside them. Multiple versions show same version number. No validation.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | version-bump.sh updates changelog.json: version, date, clears changes, placeholder title | Prevents stale metadata |
| D2 | Validation: changelog.json.version == directory name, abort on mismatch | Catches errors at source |
| D3 | Pre-commit validation for version mismatches | Prevents bad data from reaching git |
| D4 | Viz version history deduplication + warning | UI-level safety net |
| D5 | Metric: count mismatches per month, target 0 | CMM4 — measured |

### Acceptance Criteria
- AC1: version-bump.sh updates changelog.json version field automatically
- AC2: Script aborts if changelog version != directory name
- AC3: Pre-commit hook rejects version mismatches
- AC4: Viz shows deduplication warning for duplicate versions
- AC5: Zero version mismatches after deployment

### Files: `scripts/version-bump.sh`, pre-commit hook, `viz/versions/*/changelog.json`
