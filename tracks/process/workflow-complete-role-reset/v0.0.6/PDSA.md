# PDSA: Remove stale v16/ directory from main

**Task:** workflow-complete-role-reset
**Version:** v0.0.6
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

v0.0.5 renamed `workflow/v17/` to `workflow/v0.0.17/` and updated the symlink. However, the old `workflow/v16/` directory still exists on main, creating a mixed naming pattern (v16/ alongside v0.0.17/). Liaison feedback v5 requires removing v16/ entirely for pattern consistency.

## Rework Scope (from liaison feedback v5)

> The fix adopted v0.0.X naming (v0.0.17/) but left the old v16/ directory on main. This creates a mixed pattern. REQUIRED: (1) Remove v16/ from main entirely. (2) Verify no references to v16/ remain anywhere on main. (3) Only v0.0.X directories exist under workflow/.

## Investigation

### Current state on main

```
tracks/process/context/workflow/
├── v16/           ← STALE, to be removed
│   └── WORKFLOW.md
└── v0.0.17/       ← CURRENT
    └── WORKFLOW.md
```

Symlink: `WORKFLOW.md → workflow/v0.0.17/WORKFLOW.md` (already correct)

### References to v16/ on main

1. **`tracks/process/context/workflow/v16/`** — the directory itself (DELETE)
2. **`tracks/process/workflow-md-versioning/v0.0.1/PDSA.md`** — historical PDSA document referencing v16 as the original frozen copy. This is a frozen historical record — references are accurate for the time they were written. No change needed.
3. **`tracks/process/context/workflow/v0.0.17/WORKFLOW.md`** — changelog entry mentioning "v16" in history. This is a changelog reference, not a path. No change needed.
4. **`viz/workflow-md-versioning.test.ts`** — QA tests checking v16/ exists. These tests will need updating by QA (not PDSA's scope to change tests).
5. **`CLAUDE.md`** — no v16 references (already clean).

## Design

### Step 1: Delete v16/ on main

```bash
git rm -r tracks/process/context/workflow/v16/
```

This removes the stale directory. The symlink already points to v0.0.17/ so no breakage.

### Step 2: Update workflow-md-versioning tests

The `viz/workflow-md-versioning.test.ts` tests check for v16/ existence. After removal, these tests will fail. QA must update them to check for v0.0.17/ instead of v16/. This is QA's responsibility — PDSA does not change tests.

**No other changes needed.** Historical PDSA docs and changelog entries referencing "v16" are accurate historical records and should not be altered.

## Files Changed

1. `tracks/process/context/workflow/v16/` — DELETE (on main)

## Testing

1. `workflow/v16/` directory does not exist on main
2. `workflow/v0.0.17/` directory exists on main
3. Symlink resolves correctly to v0.0.17/WORKFLOW.md
4. No v16/ path references in CLAUDE.md
5. `workflow-md-versioning.test.ts` updated to check v0.0.17/ (QA responsibility)
