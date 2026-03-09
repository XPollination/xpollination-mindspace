# PDSA: TSDoc Configuration for Traceability Tags

**Task:** t1-1-tsdoc-config
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The xpollination-mcp-server project has no TSDoc custom tag definitions. Without `tsdoc.json`, the four traceability tags (`@capability`, `@requirement`, `@satisfies`, `@decision`) are unknown to TypeScript tooling. IDE autocompletion won't suggest them, linters may warn about unknown tags, and there's no machine-readable definition of the project's traceability vocabulary.

This is Phase 1 of the traceability implementation plan (REQ-TRACE-001) — the data foundation. No enforcement yet, but tags must be formally defined before agents can use them in code.

## Analysis

TSDoc uses `tsdoc.json` in the project root to define custom block tags. The file follows the `https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json` schema. Each tag needs a `tagName` (with `@` prefix) and a `syntaxKind` (`block` for multi-line content).

The traceability implementation plan (v0.0.7 addendum) specifies exactly four tags:
- `@capability` — links code to a capability (e.g., `CAP-TASK-ENGINE`)
- `@requirement` — links code to a requirement (e.g., `REQ-LEASE-001`)
- `@satisfies` — links code to a task (e.g., `A3.4`)
- `@decision` — links code to an architecture decision (e.g., `ADR-007`)

All four are `block` tags (they take content on the same or following lines).

No dependencies. No existing `tsdoc.json` in the project. The file is a single JSON config — minimal risk.

## Design

### Change A: Create `tsdoc.json` in project root

Create `tsdoc.json` at `xpollination-mcp-server/tsdoc.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "tagDefinitions": [
    { "tagName": "@capability", "syntaxKind": "block" },
    { "tagName": "@requirement", "syntaxKind": "block" },
    { "tagName": "@satisfies", "syntaxKind": "block" },
    { "tagName": "@decision", "syntaxKind": "block" }
  ]
}
```

This is verbatim from the traceability implementation plan, section T1.1.

### Files Changed

1. `tsdoc.json` — new file, project root

### Testing

1. File exists at `xpollination-mcp-server/tsdoc.json`
2. File is valid JSON
3. `$schema` points to TSDoc v0 schema
4. Four tag definitions present: `@capability`, `@requirement`, `@satisfies`, `@decision`
5. All tags have `syntaxKind: "block"`
6. No extra tags beyond the four specified
