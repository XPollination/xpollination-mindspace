# PDSA: Automated Workflow Engine Design

**Date:** 2026-02-04
**Node:** design-workflow-engine (910b3601-b5d0-429c-97fb-054c868dec32)
**Type:** Design
**Status:** ACTIVE
**Iteration:** 4 (restore dropped content + add immutability)

## PLAN

### Problem Statement

LIAISON currently acts as a manual workflow engine. Design to automate.

### Iteration History

| Iter | Issue | Resolution |
|------|-------|------------|
| 1 | Initial design | State machine, actor permissions |
| 2 | Simplify types | Only bug + task. PROHIBIT undefined. |
| 3 | complete used twice | Added `approved` status |
| 4 | Content dropped | Restore validateCreate, CRITICAL PRINCIPLE, add immutability |

---

## DO (Findings)

### CRITICAL PRINCIPLE (Restored from Iteration 2)

**If the system does not PREVENT it, it WILL happen.**

- Undefined transitions → chaos
- Invalid types → confusion
- Modifying complete tasks → audit trail corruption

**Validation at write time, not review time.**

### Issue Types: ONLY TWO

| Type | Description | PDSA Required? |
|------|-------------|----------------|
| `task` | New work, feature, requirement | YES - must go through PDSA |
| `bug` | Fix for known issue | NO - can bypass to dev |

### Statuses (10 total)

- `pending` - Not yet released
- `ready` - Available for claiming
- `active` - Being worked on
- `approval` - Awaiting human approval (Thomas)
- `approved` - Design approved, ready for dev handoff
- `review` - Awaiting QA review
- `rework` - Needs revision
- `complete` - **FINAL** state, **IMMUTABLE**
- `blocked` - Cannot proceed
- `cancelled` - Abandoned (terminal)

### Type: task - Transition Table

| From | To | Actor | Role Change | Description |
|------|-----|-------|-------------|-------------|
| pending | ready | liaison/system | → pdsa | Release for PDSA research |
| ready | active | pdsa | (stays pdsa) | PDSA claims task |
| active | approval | pdsa | (stays pdsa) | PDSA submits design, awaits Thomas |
| approval | approved | thomas | (stays pdsa) | Thomas approves design |
| approval | rework | thomas | (stays pdsa) | Thomas requests changes |
| rework | active | pdsa | (stays pdsa) | PDSA revises |
| approved | ready | system | → dev | Auto-release for dev |
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

### ALLOWED_TRANSITIONS (Complete)

```javascript
const ALLOWED_TRANSITIONS = {
  task: {
    'pending->ready': { actor: ['liaison', 'system'], setRole: 'pdsa' },
    'ready->active': { actor: ['pdsa', 'dev'], setRole: null },
    'active->approval': { actor: ['pdsa'], setRole: null },
    'approval->approved': { actor: ['thomas'], setRole: null },
    'approval->rework': { actor: ['thomas'], setRole: null },
    'rework->active': { actor: ['pdsa', 'dev'], setRole: null },
    'approved->ready': { actor: ['system'], setRole: 'dev' },
    'active->review': { actor: ['dev'], setRole: 'qa' },
    'review->complete': { actor: ['qa'], setRole: null },
    'review->rework': { actor: ['qa'], setRole: 'dev' }
  },
  bug: {
    'pending->ready': { actor: ['liaison', 'system'], setRole: 'dev' },
    'ready->active': { actor: ['dev'], setRole: null },
    'active->review': { actor: ['dev'], setRole: 'qa' },
    'review->complete': { actor: ['qa'], setRole: null },
    'review->rework': { actor: ['qa'], setRole: 'dev' },
    'rework->active': { actor: ['dev'], setRole: null }
  }
};
```

### validateCreate() Function (Restored from Iteration 2)

```javascript
function validateCreate(type) {
  if (!['task', 'bug'].includes(type)) {
    throw new Error(`Invalid type: ${type}. Only 'task' and 'bug' allowed.`);
  }
}
```

### Immutability Rule (NEW - Iteration 4)

**Rule:** Once `status=complete`, task DNA is **IMMUTABLE**.

**Rationale:**
- Complete tasks represent historical record
- Audit trail must be preserved
- Prevents accidental data corruption
- Extensions create NEW child tasks

**Implementation in interface-cli.js:**

```javascript
function cmdUpdateDna(id, dnaJson, actor) {
  // ... existing code ...

  // IMMUTABILITY CHECK
  if (node.status === 'complete') {
    error(`Cannot modify complete task ${id}. Create a child task instead.`);
  }

  // ... rest of update logic ...
}
```

### Actor Permission Matrix

| Actor | Allowed Actions |
|-------|-----------------|
| liaison | pending→ready, any→cancelled, any→blocked |
| thomas | approval→approved, approval→rework |
| pdsa | ready→active (if role=pdsa), active→approval |
| dev | ready→active (if role=dev), active→review |
| qa | review→complete, review→rework |
| system | pending→ready, approved→ready (auto-release) |

### Visual Flow Diagram

**Task flow:**
```
pending → ready(pdsa) → active → approval → APPROVED → ready(dev) → active → review → COMPLETE*
                           ↑        ↓                                           ↓
                        rework ←────┘                                       rework

*COMPLETE = FINAL + IMMUTABLE
```

**Bug flow:**
```
pending → ready(dev) → active → review → COMPLETE*
                         ↑        ↓
                      rework ←────┘

*COMPLETE = FINAL + IMMUTABLE
```

---

## STUDY

### Iteration 4 Resolutions

| Item | Status |
|------|--------|
| CRITICAL PRINCIPLE | Restored |
| validateCreate() | Restored |
| Immutability rule | Added |
| Content accumulation | Understood - iterations ADD, not REPLACE |

### Validation Enforcement

| Check | Location | Rejects |
|-------|----------|---------|
| Type validation | validateCreate() | Non-task/bug types |
| Transition validation | ALLOWED_TRANSITIONS | Undefined transitions |
| Actor validation | actor arrays | Wrong actor for transition |
| Role validation | ready→active check | Wrong role claiming |
| **Immutability** | cmdUpdateDna | **update-dna on complete** |

---

## ACT

### Implementation Tasks (Cumulative)

1. **TransitionValidator** - ALLOWED_TRANSITIONS whitelist
2. **TypeValidator** - validateCreate() rejects non-task/bug
3. **RoleTransitioner** - update role based on setRole rules
4. **ActorAuthorizer** - verify actor can perform transition
5. **Claim enforcement** - only matching role can ready→active
6. **NotificationService** - write to /tmp/human-notification.json
7. **Immutability check** - reject update-dna on status=complete
8. **Integration** - add all validation to interface-cli.js
9. **Add `approved` status** - to VALID_STATUSES

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
