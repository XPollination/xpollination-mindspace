# PDSA: Fix Version Bump Enforcement

**Task:** ms-version-bump-enforcement
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 iteration

## Problem

Version bump gate exists but not enforcing: (1) tasks don't declare versioned_component, (2) jq not installed, (3) no auto-detection from git diff, (4) LIAISON bypasses by merging directly.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Auto-detect versioned_component from implementation.commit git diff | Check if viz/, api/, brain/ files modified |
| D2 | Rewrite version-bump.sh to use node instead of jq for JSON parsing | node available, jq not installed |
| D3 | Gate auto-fires based on git diff, not manual DNA field | Removes human error from enforcement |
| D4 | LIAISON task creation auto-sets versioned_component from group field | VIZ group → viz component, AUTH → api, etc. |
| D5 | Document: gate fires during workflow transitions only, not git merge | Known limitation — git hooks are Phase 2 |

### Acceptance Criteria

- AC1: version-bump.sh works without jq (uses node for JSON)
- AC2: Gate auto-detects versioned_component from implementation commit
- AC3: Tasks in VIZ group auto-tagged with versioned_component=viz
- AC4: Gate fires on review→complete when versioned component detected
- AC5: version_bump_ref required before completion

### Files to Change

- `scripts/version-bump.sh` — Replace jq with node JSON parsing
- `src/db/workflow-engine.js` — Auto-detect from git diff or group field
- `src/db/interface-cli.js` — Wire auto-detection into transition handler

## Do / Study / Act

(To be completed)
