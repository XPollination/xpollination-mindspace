# PDSA: Move WORKFLOW.md into versioning pattern

**Task:** workflow-md-versioning
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

WORKFLOW.md at `tracks/process/context/WORKFLOW.md` is a knowledge artifact that has been edited in-place across 16 versions. The versioning pattern (brain: immutable snapshots, lazy restructuring) requires versioned directories with frozen snapshots. Currently violates this pattern.

## Current State

- `tracks/process/context/WORKFLOW.md` — 254 lines, DRAFT v16
- Other context files: `DOCUMENTATION.md`, `TEMPLATE.pdsa.md`, `Tutorials/`
- Per task DNA: only restructure WORKFLOW.md (lazy = only when touched)

## Design

### Change A: Create versioned directory structure

```
tracks/process/context/workflow/
  v16/
    WORKFLOW.md    ← frozen copy of current v16
  WORKFLOW.md      ← symlink to v16/WORKFLOW.md (backward compat)
```

**Why symlink:** The codebase has references to `tracks/process/context/WORKFLOW.md` (in CLAUDE.md, agent skills, brain thoughts). A symlink at the original path ensures nothing breaks.

**Why v16 not v0.0.1:** WORKFLOW.md already has 16 documented versions in its changelog. Starting at v0.0.1 would lose this history. The version number should match the document's own versioning.

### Change B: Future workflow

When WORKFLOW.md needs editing:
1. Copy `workflow/v16/WORKFLOW.md` to `workflow/v17/WORKFLOW.md`
2. Edit the new copy
3. Update symlink: `WORKFLOW.md → v17/WORKFLOW.md`
4. v16 remains frozen (immutable snapshot)

This is documented as a comment in the symlink or in a README.

### Change C: Do NOT restructure other context files

Per task DNA: "Apply lazy restructuring ONLY if touched." DOCUMENTATION.md and TEMPLATE.pdsa.md are not being touched in this task — leave them as-is.

### Files Changed

1. `tracks/process/context/workflow/v16/WORKFLOW.md` — frozen copy of current WORKFLOW.md
2. `tracks/process/context/WORKFLOW.md` — replaced with symlink to `workflow/v16/WORKFLOW.md`

### Testing

1. Verify symlink resolves: `cat tracks/process/context/WORKFLOW.md` returns content
2. Verify frozen copy exists: `cat tracks/process/context/workflow/v16/WORKFLOW.md`
3. Verify content identical: `diff` between symlink target and original
4. Verify no broken references in CLAUDE.md or agent skills
