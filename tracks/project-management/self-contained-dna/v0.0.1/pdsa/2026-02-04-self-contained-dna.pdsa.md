# PDSA: Self-Contained DNA Schema and Validation

**Date:** 2026-02-04
**Node:** design-self-contained-dna (4d4390c3-8c8b-4e99-a38e-f1271f9c0582)
**Type:** Design
**Status:** REVIEW
**Requirement:** feature-self-contained-dna (2395f9f9-cd4c-4ced-b262-4fe2051976c2)

## PLAN

### Problem Statement

PDSA agent completed tasks but findings were NOT in the task DNA:
- Relied on external PDSA document links
- Links can break (wrong repo, wrong path)
- Context fragmented across files
- Agents/LIAISON can't see full picture from task alone

### Design Principle

**The OBJECT (task/node) should be SELF-CONTAINED:**
- All inputs IN the DNA
- All outputs IN the DNA
- All findings IN the DNA
- No external links required to understand the object

---

## DO (Findings)

### AC1: DNA Schema with Input/Output Fields

**Required fields:**
- `title` - task title
- `description` - what to do
- `role` - assigned agent (dev, pdsa, qa)
- `project` - project name
- `acceptance_criteria` - array of ACs

**Output fields (at least one required before complete):**
- `findings` - what agent discovered
- `proposed_design` - agent's proposal (for design tasks)
- `implementation` - what was built (for dev tasks)
- `test_results` - QA verification (for test tasks)
- `decision` - final decision made
- `outcome` - what happened

### AC2: Agent Requirement

**Rule:** Agent MUST write findings to DNA before transitioning to complete/review.

**Enforcement:** Workflow engine validates DNA before status transition.

**Documentation:** Added to CLAUDE.md under "Self-Contained Objects (CRITICAL)"

### AC3: Validation Rule

**Name:** RequireOutputBeforeComplete

**Logic:**
```javascript
if (toStatus === 'complete' || toStatus === 'review') {
  if (!dna.findings && !dna.implementation && !dna.test_results) {
    throw Error('Output fields required before completion');
  }
}
```

**Location:** src/workflow/TransitionValidator.ts

### AC4: Workflow Engine Integration

- TransitionValidator checks output fields before allowing transition
- Engine reads task DNA to make routing decisions
- No external file access needed - DNA is complete

### AC5: Dual-Link Deprecation

**Old pattern:** pdsa_ref with git URL + workspace path
**New pattern:** All content embedded in DNA
**Migration:** PDSA documents still exist for human reading, but DNA is source of truth

---

## STUDY

### Self-Correction

I (PDSA agent) was completing tasks without embedding findings in DNA. This violated the self-contained principle I was supposed to be implementing.

### Lesson Learned

The object (task node) must be readable standalone. If someone queries the database, they should understand everything without following external links.

---

## ACT

### Changes Made

1. Updated CLAUDE.md with self-contained object requirement
2. Created design node linked to requirement
3. This PDSA document created for human reference

### Awaiting Thomas Review

- Approve DNA schema
- Approve validation rule
- Approve workflow engine integration plan

---

**PDSA Ref (dual format - kept for transition):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-self-contained-dna.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-self-contained-dna.pdsa.md
