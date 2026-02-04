# PDSA: Automated Workflow Engine Design

**Date:** 2026-02-04
**Node:** design-workflow-engine (910b3601-b5d0-429c-97fb-054c868dec32)
**Type:** Design
**Status:** ACTIVE
**Iteration:** 3 (rework - complete status confusion)

## PLAN

### Problem Statement

LIAISON currently acts as a manual workflow engine. Design to automate.

### Iteration 3 Issue

`complete` was used twice in task flow:
1. After Thomas approves design → complete (then goes to ready again)
2. After QA approves implementation → complete (final)

**Principle violated:** complete should mean DONE - final state, not intermediate.

### Solution

Add `approved` status for post-Thomas-approval state.

---

## DO (Findings)

### Issue Types: ONLY TWO

| Type | Description | PDSA Required? |
|------|-------------|----------------|
| `task` | New work, feature, requirement | YES - must go through PDSA |
| `bug` | Fix for known issue | NO - can bypass to dev |

### Statuses (Updated - Iteration 3)

- `pending` - Not yet released
- `ready` - Available for claiming
- `active` - Being worked on
- `approval` - Awaiting human approval (Thomas)
- **`approved`** - Design approved, ready for dev handoff (**NEW**)
- `review` - Awaiting QA review
- `rework` - Needs revision
- `complete` - **FINAL** state only
- `blocked` - Cannot proceed
- `cancelled` - Abandoned

### Type: task - Transition Table (Iteration 3)

| From | To | Actor | Role Change | Description |
|------|-----|-------|-------------|-------------|
| pending | ready | liaison/system | → pdsa | Release for PDSA research |
| ready | active | pdsa | (stays pdsa) | PDSA claims task |
| active | approval | pdsa | (stays pdsa) | PDSA submits design, awaits Thomas |
| approval | **approved** | thomas | (stays pdsa) | Thomas approves design |
| approval | rework | thomas | (stays pdsa) | Thomas requests changes |
| rework | active | pdsa | (stays pdsa) | PDSA revises |
| **approved** | ready | system | → dev | Auto-release for dev |
| ready | active | dev | (stays dev) | Dev claims implementation |
| active | review | dev | → qa | Dev submits, awaits QA |
| review | complete | qa | (stays qa) | QA approves - **FINAL** |
| review | rework | qa | → dev | QA requests changes |
| rework | active | dev | (stays dev) | Dev revises |

### Type: bug - Transition Table

| From | To | Actor | Role Change | Description |
|------|-----|-------|-------------|-------------|
| pending | ready | liaison/system | → dev | Direct to dev (PDSA bypassed) |
| ready | active | dev | (stays dev) | Dev claims |
| active | review | dev | → qa | Dev submits fix |
| review | complete | qa | (stays qa) | QA approves - **FINAL** |
| review | rework | qa | → dev | QA requests changes |
| rework | active | dev | (stays dev) | Dev revises |

### Updated ALLOWED_TRANSITIONS (Iteration 3)

```javascript
const ALLOWED_TRANSITIONS = {
  task: {
    'pending->ready': { actor: ['liaison', 'system'], setRole: 'pdsa' },
    'ready->active': { actor: ['pdsa', 'dev'], setRole: null },
    'active->approval': { actor: ['pdsa'], setRole: null },
    'approval->approved': { actor: ['thomas'], setRole: null },  // NEW
    'approval->rework': { actor: ['thomas'], setRole: null },
    'rework->active': { actor: ['pdsa', 'dev'], setRole: null },
    'approved->ready': { actor: ['system'], setRole: 'dev' },    // CHANGED
    'active->review': { actor: ['dev'], setRole: 'qa' },
    'review->complete': { actor: ['qa'], setRole: null },         // FINAL only
    'review->rework': { actor: ['qa'], setRole: 'dev' }
  },
  bug: {
    'pending->ready': { actor: ['liaison', 'system'], setRole: 'dev' },
    'ready->active': { actor: ['dev'], setRole: null },
    'active->review': { actor: ['dev'], setRole: 'qa' },
    'review->complete': { actor: ['qa'], setRole: null },         // FINAL only
    'review->rework': { actor: ['qa'], setRole: 'dev' },
    'rework->active': { actor: ['dev'], setRole: null }
  }
};
```

### Visual Flow Diagram

**Task flow:**
```
pending → ready(pdsa) → active → approval → APPROVED → ready(dev) → active → review → COMPLETE
                           ↑        ↓                                           ↓
                        rework ←────┘                                       rework
```

**Bug flow:**
```
pending → ready(dev) → active → review → COMPLETE
                         ↑        ↓
                      rework ←────┘
```

### Actor Permission Matrix (Updated)

| Actor | Allowed Actions |
|-------|-----------------|
| liaison | pending→ready, any→cancelled, any→blocked |
| thomas | approval→approved, approval→rework |
| pdsa | ready→active (if role=pdsa), active→approval |
| dev | ready→active (if role=dev), active→review |
| qa | review→complete, review→rework |
| system | pending→ready, approved→ready (auto-release) |

---

## STUDY

### Iteration 3 Resolution

| Issue | Resolution |
|-------|------------|
| complete used twice | Added `approved` status. complete is now FINAL only. |
| Confusing intermediate state | approved→ready transition clearly separates design phase from dev phase |

### Status Meanings (Clear Definitions)

| Status | Meaning | Final? |
|--------|---------|--------|
| pending | Created, not released | No |
| ready | Available for claiming | No |
| active | Being worked on | No |
| approval | Awaiting human (Thomas) | No |
| approved | Design approved, pending dev release | No |
| review | Awaiting QA | No |
| rework | Needs revision | No |
| **complete** | **DONE - work finished** | **YES** |
| blocked | Cannot proceed | No |
| cancelled | Abandoned | Yes (terminal) |

---

## ACT

### Implementation Tasks (Iteration 3)

1. **Add `approved` to VALID_STATUSES** in interface-cli.js
2. **Update ALLOWED_TRANSITIONS** with new approved transitions
3. **Update viz** to show approved status (color: #8b5cf6 purple?)
4. **Test** full task flow through all statuses

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
