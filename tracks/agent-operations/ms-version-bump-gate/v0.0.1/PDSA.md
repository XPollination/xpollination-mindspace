# PDSA: Version Bump Orchestrator — Script + Workflow Gate

**Task:** ms-version-bump-gate
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.8

## Problem

Multiple parallel tasks modify versioned components (viz, workflow, API). No mechanism ensures version bumps happen or are sequenced. Agent coordination is unreliable. Need automated script + workflow engine gate.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | `scripts/version-bump.sh` — pure bash, reads active symlink, creates next version dir, updates symlink | No LLM/server dependency, works decentralized |
| D2 | Component registry `scripts/version-components.json` mapping component→version dirs | Extensible, single source of truth for version paths |
| D3 | New DNA field `version_bump_ref` (git commit SHA of version bump) | Traceable proof that version was bumped |
| D4 | Workflow gate: if task modifies versioned component dir and has no `version_bump_ref`, block transition | Enforcement at review->complete and active->review |
| D5 | Component detection via task DNA or commit paths (viz/, api/, tracks/process/) | Automatic detection, no manual tagging needed |
| D6 | Version parsing: extract numeric suffix from `v0.0.X`, increment last segment | Simple semver-minor-like pattern matching current convention |

### Component Registry Schema

```json
{
  "viz": {
    "versions_dir": "viz/versions/",
    "active_symlink": "viz/active",
    "pattern": "v0.0.{n}"
  },
  "workflow": {
    "versions_dir": "tracks/process/context/workflow/",
    "active_symlink": null,
    "pattern": "v{n}"
  }
}
```

### Script Interface

```bash
# Usage
scripts/version-bump.sh <component>

# Example
scripts/version-bump.sh viz
# → Creates viz/versions/v0.0.26/ (copy from v0.0.25)
# → Updates viz/active symlink → versions/v0.0.26
# → git add + commit
# → Outputs: v0.0.26
```

### Acceptance Criteria

- AC1: `scripts/version-bump.sh viz` creates next version dir from current active
- AC2: Script updates active symlink to new version
- AC3: Script commits with message `version: bump viz to v0.0.X`
- AC4: `scripts/version-components.json` defines component paths
- AC5: Workflow engine blocks review->complete if versioned component modified without `version_bump_ref`
- AC6: Error message names which component needs bumping
- AC7: Script is idempotent (running twice doesn't break anything)
- AC8: Works for viz (tested), extensible for workflow/api

### Files to Create

- `scripts/version-bump.sh` — Version bump script
- `scripts/version-components.json` — Component registry

### Files to Change

- `src/db/workflow-engine.js` — Add `version_bump_ref` gate on relevant transitions

### Test Plan

1. Run `scripts/version-bump.sh viz` → verify new version dir + symlink + commit
2. Run it again → verify idempotent (no error, creates next version)
3. Attempt review->complete on task touching viz/ without `version_bump_ref` → blocked
4. Set `version_bump_ref` in DNA → transition succeeds
5. Task not touching versioned components → no gate

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
