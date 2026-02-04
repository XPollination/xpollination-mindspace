# PDSA: Extend Workflow Engine - Bypass Path + Immutability Rules

**Date:** 2026-02-04
**Node:** extend-workflow-engine-rules (e4cbab88-f72a-4f8b-8d43-680268a4b7fd)
**Type:** Design
**Status:** ACTIVE

## PLAN

### Problem Statement

Two workflow gaps observed:
1. **migrate-to-database-interface** went direct from parent complete → child task → ready for dev without PDSA phase. Was this correct?
2. **LIAISON** accidentally updated DNA on a task believed to be complete. Data integrity risk.

### Goals

- AC1: Define when full PDSA vs bypass is appropriate
- AC2: Document immutability rule for complete tasks
- AC3: interface-cli.js enforces immutability (reject updates to complete)

---

## DO (Findings)

### AC1: PDSA Bypass Decision Matrix

**Full PDSA Required:**
| Scenario | Why |
|----------|-----|
| New feature implementation | Unclear scope, needs research |
| Architectural decisions | Multiple approaches, trade-offs |
| Third-party integration | Unknown API behavior |
| Performance optimization | Requires measurement, analysis |
| Security-related changes | Risk assessment needed |

**Bypass Allowed:**
| Scenario | Why |
|----------|-----|
| Direct follow-up task | Parent PDSA already done, solution known |
| Bug fix with known cause | No research needed |
| Configuration change | Mechanical, no design needed |
| Documentation update | No code design |
| Migration with clear spec | Steps defined, just execution |

**Decision Rule:**
```
IF solution_known AND no_design_decisions_needed THEN
    bypass PDSA → create task directly with status=ready, role=dev
ELSE
    require PDSA → create design task with status=ready, role=pdsa
END
```

### AC2: Immutability Rule for Complete Tasks

**Rule:** Once `status=complete`, task DNA is IMMUTABLE.

**Rationale:**
- Completed tasks represent historical record
- Audit trail must be preserved
- Prevents accidental data corruption
- Extensions should create NEW child tasks

**What IS allowed on complete tasks:**
- Read operations
- Creating child tasks that reference the parent

**What is NOT allowed:**
- update-dna
- Any DNA field modification

### AC3: interface-cli.js Enforcement

**Current State:** No immutability check exists

**Required Change:**

```javascript
// In interface-cli.js update-dna command

async function updateDna(taskId, dnaUpdates, actor) {
  const task = getNode(taskId);

  // IMMUTABILITY CHECK
  if (task.status === 'complete') {
    throw new Error(`Cannot modify complete task ${taskId}. Create a child task instead.`);
  }

  // ... existing update logic
}
```

**Error Message Pattern:**
```
Error: Cannot modify complete task [ID]. Create a child task instead.
```

---

## STUDY

### Design Validation

| AC | Design | Validation |
|----|--------|------------|
| AC1 | Decision matrix | Clear rules for when bypass is appropriate |
| AC2 | Immutability rule | Simple, enforceable, preserves history |
| AC3 | interface-cli.js check | Single point of enforcement |

### Edge Cases

1. **What if a task is incorrectly marked complete?**
   - System admin can manually fix in database
   - Requires explicit action, not accidental

2. **What about adding review comments?**
   - Review comments should be on child tasks or separate review nodes
   - Keeps complete task immutable

3. **Bypass path abuse?**
   - QA review catches missing PDSA on complex tasks
   - Orchestrator can challenge inappropriate bypasses

---

## ACT

### Implementation Tasks

1. **Dev task:** Add immutability check to interface-cli.js
2. **Doc task:** Update workflow documentation with bypass rules
3. **Config task:** Update agent prompts to understand bypass vs full PDSA

### Proposed Implementation Order

1. interface-cli.js immutability check (blocks data corruption)
2. Documentation update (informs agents)
3. Agent prompt updates (enforces understanding)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-extend-workflow-engine-rules.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-extend-workflow-engine-rules.pdsa.md
