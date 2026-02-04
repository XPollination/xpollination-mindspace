# PDSA: Automated Workflow Engine Design

**Date:** 2026-02-04
**Node:** design-workflow-engine (910b3601-b5d0-429c-97fb-054c868dec32)
**Type:** Design
**Status:** ACTIVE
**Iteration:** 2 (rework from Thomas/LIAISON feedback)

## PLAN

### Problem Statement

LIAISON currently acts as a manual workflow engine:
- Polls task statuses every 10s
- Routes tasks between agents (PDSA → Thomas review → Dev → QA)
- Transitions statuses manually
- Fixes issues (status spelling, missing fields)
- Reports progress to Thomas

This manual process is BY DESIGN to learn what an automated workflow engine needs.

### Goals (Updated)

- AC1: Document current manual workflow patterns observed
- AC2: Propose status enhancement for design approval gate
- AC3: Define complete state machine with **SIMPLIFIED types (bug, task only)**
- AC4: Specify actor permissions for each transition
- AC5: Design human notification mechanism for approval gates
- AC6: Propose workflow engine architecture
- AC7: Thomas reviews and approves before implementation
- **AC-REWORK-1:** PROHIBIT undefined transitions (validation at write time)
- **AC-REWORK-2:** Add role column to transition table
- **AC-REWORK-3:** Remove requirement/design/test types

---

## DO (Findings)

### AC1: Current Manual Workflow Patterns

**Observed flow:** LIAISON polls → finds status change → routes to next actor → monitors → reports

**Pain points:**
- High token usage for polling
- Manual error correction
- No human notification mechanism

### AC2: Approval Gate Recommendation

**New status:** `approval`

**Rationale:** Distinguish human design approval from QA technical review

### AC3: Complete State Machine (SIMPLIFIED - Iteration 2)

**Issue Types: ONLY TWO**
| Type | Description | PDSA Required? |
|------|-------------|----------------|
| `task` | New work, feature, requirement | YES - must go through PDSA |
| `bug` | Fix for known issue | NO - can bypass to dev |

**Statuses:**
- `pending` - Not yet released
- `ready` - Available for claiming
- `active` - Being worked on
- `approval` - Awaiting human approval (task only)
- `review` - Awaiting QA review
- `rework` - Needs revision
- `complete` - Done
- `blocked` - Cannot proceed
- `cancelled` - Abandoned

### AC3 + AC-REWORK-2: Transition Table with Role Changes

**Type: task (requires PDSA)**

| From | To | Actor | Role Change | Description |
|------|-----|-------|-------------|-------------|
| pending | ready | liaison/system | → pdsa | Release for PDSA research |
| ready | active | pdsa | (stays pdsa) | PDSA claims task |
| active | approval | pdsa | (stays pdsa) | PDSA submits design, awaits Thomas |
| approval | complete | thomas | → dev | Thomas approves, ready for dev |
| approval | rework | thomas | (stays pdsa) | Thomas requests changes |
| rework | active | pdsa | (stays pdsa) | PDSA revises |
| complete | ready | system | → dev | Auto-release for dev (post-approval) |
| ready | active | dev | (stays dev) | Dev claims implementation |
| active | review | dev | → qa | Dev submits, awaits QA |
| review | complete | qa | (stays qa) | QA approves |
| review | rework | qa | → dev | QA requests changes |
| rework | active | dev | (stays dev) | Dev revises |

**Type: bug (bypasses PDSA)**

| From | To | Actor | Role Change | Description |
|------|-----|-------|-------------|-------------|
| pending | ready | liaison/system | → dev | Direct to dev (PDSA bypassed) |
| ready | active | dev | (stays dev) | Dev claims |
| active | review | dev | → qa | Dev submits fix |
| review | complete | qa | (stays qa) | QA approves |
| review | rework | qa | → dev | QA requests changes |
| rework | active | dev | (stays dev) | Dev revises |

### AC-REWORK-1: PROHIBIT Undefined Transitions

**CRITICAL PRINCIPLE:** If the system does not PREVENT it, it WILL happen.

**Implementation:**

```javascript
// In TransitionValidator
const ALLOWED_TRANSITIONS = {
  task: {
    'pending->ready': { actor: ['liaison', 'system'], setRole: 'pdsa' },
    'ready->active': { actor: ['pdsa', 'dev'], setRole: null }, // actor must match current role
    'active->approval': { actor: ['pdsa'], setRole: null },
    'approval->complete': { actor: ['thomas'], setRole: 'dev' },
    'approval->rework': { actor: ['thomas'], setRole: null },
    'rework->active': { actor: ['pdsa', 'dev'], setRole: null },
    'complete->ready': { actor: ['system'], setRole: 'dev' }, // post-approval auto-release
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

function validateTransition(type, fromStatus, toStatus, actor, currentRole) {
  const key = `${fromStatus}->${toStatus}`;
  const typeRules = ALLOWED_TRANSITIONS[type];

  // REJECT: Unknown type
  if (!typeRules) {
    throw new Error(`Invalid type: ${type}. Only 'task' and 'bug' allowed.`);
  }

  // REJECT: Undefined transition
  const rule = typeRules[key];
  if (!rule) {
    throw new Error(`Transition ${key} not allowed for type ${type}.`);
  }

  // REJECT: Wrong actor
  if (!rule.actor.includes(actor)) {
    throw new Error(`Actor '${actor}' cannot perform ${key}.`);
  }

  // REJECT: Actor doesn't match role (for role-specific transitions)
  if (key === 'ready->active' && actor !== currentRole && actor !== 'system') {
    throw new Error(`Only assigned role can claim: current role is ${currentRole}, actor is ${actor}.`);
  }

  return { allowed: true, setRole: rule.setRole };
}
```

**Type validation at creation:**

```javascript
function validateCreate(type) {
  if (!['task', 'bug'].includes(type)) {
    throw new Error(`Invalid type: ${type}. Only 'task' and 'bug' allowed.`);
  }
}
```

### AC4: Actor Permission Matrix (Updated)

| Actor | Allowed Actions |
|-------|-----------------|
| liaison | pending→ready for task/bug, any→cancelled, any→blocked |
| thomas | approval→complete, approval→rework |
| pdsa | ready→active (if role=pdsa), active→approval |
| dev | ready→active (if role=dev), active→review |
| qa | review→complete, review→rework |
| system | pending→ready, complete→ready (auto-release) |

### AC5: Human Notification Mechanism

**Trigger:** When status transitions to `approval`

**Mechanism:** Write to `/tmp/human-notification.json`:
```json
{
  "node_id": "...",
  "title": "...",
  "type": "task",
  "requires": "Thomas approval",
  "link": "viz URL",
  "created_at": "ISO timestamp"
}
```

### AC6: Workflow Engine Architecture

**Components:**
1. **TransitionValidator** - validates status changes against rules, REJECTS undefined
2. **TypeValidator** - REJECTS invalid types at creation
3. **ActorAuthorizer** - checks permission for actor+transition+role
4. **RoleTransitioner** - updates role based on transition rules
5. **NotificationService** - triggers on status changes
6. **WorkflowPoller** - replaces manual LIAISON polling

**Location:** `src/workflow/`

**Integration point:** `interface-cli.js transition` command calls TransitionValidator

---

## STUDY

### Rework Items Addressed

| ID | Feedback | Resolution |
|----|----------|------------|
| Q1 | Add bypass path, PROHIBIT undefined | Bug type bypasses PDSA. ALLOWED_TRANSITIONS whitelist rejects all undefined. |
| Q2 | Simplify to bug + task | Done. Only two types allowed. TypeValidator rejects others. |
| Q3 | Add role to transition table | Done. Role column shows when role changes on each transition. |
| Q4 | Remove requirement/design/test | Done. Only bug and task exist now. |

### Validation Principle

**CRITICAL:** Validation at write time, not review time.
- Any transition not in ALLOWED_TRANSITIONS → REJECTED
- Any type not in ['task', 'bug'] → REJECTED
- Any actor not permitted for transition → REJECTED
- Any claim by wrong role → REJECTED

---

## ACT

### Implementation Tasks (Updated)

1. **TransitionValidator** - ALLOWED_TRANSITIONS whitelist
2. **TypeValidator** - reject non-task/bug at creation
3. **RoleTransitioner** - update role based on setRole rules
4. **ActorAuthorizer** - verify actor can perform transition
5. **Claim enforcement** - only matching role can ready→active
6. **NotificationService** - write to /tmp/human-notification.json
7. **Integration** - add validation to interface-cli.js

### Decision Made

**Issue types:** `task` and `bug` only.
- `task` = requires PDSA (new work, features, requirements)
- `bug` = bypasses PDSA (known issue, clear fix)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
