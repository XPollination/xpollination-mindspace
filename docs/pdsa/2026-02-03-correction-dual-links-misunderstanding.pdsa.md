# PDSA: Correction - Dual Links Misunderstanding

**Date:** 2026-02-03
**Type:** Correction
**Status:** ACTIVE

## PLAN

### Problem Statement
Tasks `69cf2fd3-e19b-40d9-9e67-a023d75b1ce0` and `90e7bb6a-c025-4f86-b29a-25dd5327c4ba` were labeled "dual links" but implemented a different (also valid) feature: clickable parent/child navigation links in the UI.

### Thomas's Clarification (verbatim)
> "Tasks 69cf2fd3 and 90e7bb6a are WRONG. Duallink was misunderstood."
> "The parent/child links that were added are GOOD - keep them. But dual links is a SEPARATE task that still needs to be done."

### What Dual Links Actually Means

From HomeAssistant CLAUDE.md:
> "GitHub dual links only work after push. No push = broken links."

Thomas's clarification:
> "clickable links to git (for humans) and workspace paths (for agents direct access)"

**Dual links = two reference formats in documentation/objects:**
1. **Git URL (for humans):** `https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/file.pdsa.md`
2. **Workspace path (for agents):** `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/file.pdsa.md`

### What Was Implemented (KEEP - it's good)
Parent/child clickable links in the visualization UI:
- Show parent nodes (from `parent_ids`) as clickable links
- Show child nodes (nodes that reference this one) as clickable links
- Clicking navigates to that node

This is a valid, useful feature - just incorrectly named.

### Additional Corrections

**Task 6ac36982 (viz-structure-fix):** STOP
> "current view is better. Thomas prefers stations-per-status layout."

**History/Traceability:**
> "History is clear. Objects have requirement info in details/descriptions. Each process step adds what it needs for full history."

## DO

### Completed Actions

1. **RENAME task 69cf2fd3:**
   - Old: "Design Clickable Dual Links in Package Details"
   - New: "Design Clickable Parent and Child Links"

2. **RENAME task 90e7bb6a:**
   - Old: "Implement Clickable Dual Links"
   - New: "Implement Clickable Parent and Child Links"

3. **STOP task 6ac36982:**
   - Title: "Fix Visualization Structure - Stations by Type"
   - Status: stopped
   - Reason: Thomas prefers current stations-per-status layout

4. **CREATE new tasks for actual dual links feature** (pending)

### New Tasks to Create

**Design task:**
- Title: Design Dual Link Format for PDSA and Object References
- Description: Define the dual link format (git URL + workspace path) for cross-references between PDSAs, objects, and documentation. Enables humans to click and view in GitHub, agents to directly access files.

**Implementation task:**
- Title: Implement Dual Links in PDSA Templates
- Description: Update PDSA documents and object `pdsa_ref` fields to use dual link format.

## STUDY

### Root Cause Analysis
- "Dual links" was interpreted literally as "two types of links" (parent + child)
- The actual meaning is "two formats of the same link" (git URL + workspace path)
- Terminology confusion - no prior documentation of dual link format

### Impact
- No code damage - parent/child links are useful and kept
- One task needs renaming, one needs stopping
- New tasks needed for actual feature

## ACT

### Learnings to Document

1. **Dual links = git URL + workspace path**, not parent + child navigation
2. When terminology is ambiguous, verify with Thomas before implementing
3. Parent/child clickable links are a separate, valid feature

### Process Improvements
- Add "dual link format" definition to CLAUDE.md
- Use explicit terminology: "parent/child navigation" vs "dual link references"

---

**PDSA Ref (dual format example):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-correction-dual-links-misunderstanding.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-correction-dual-links-misunderstanding.pdsa.md
