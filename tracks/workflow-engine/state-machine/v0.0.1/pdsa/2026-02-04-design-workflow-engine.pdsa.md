# PDSA: Automated Workflow Engine Design

**Date:** 2026-02-04
**Node:** design-workflow-engine (910b3601-b5d0-429c-97fb-054c868dec32)
**Type:** Design
**Status:** ACTIVE
**Iteration:** 7 (add migration chapter for existing types)

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
| 5 | Viz missing statuses | Add AC for viz showing all 10 statuses |
| 6 | Role code missing | Add validateTransition() with role enforcement |
| 7 | Migration missing | Add migration chapter for existing types |

### Iteration 6 Explanation

**Why were items missed in iterations 3-5?**

PDSA agent treated "update PDSA" as "rewrite PDSA" instead of "add to PDSA". Summary/replacement approach caused items to be dropped without verification.

**Lesson learned file created:** `/home/developer/.claude/lessons-learned/pdsa-feedback-tracking.md`

**Process fix:** Before submitting, verify EACH feedback item is verifiably present in PDSA.

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

### validateTransition() Function with ROLE ENFORCEMENT (NEW - Iteration 6)

**This is the ACTUAL CODE, not just a description.**

```javascript
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
    throw new Error(`Actor '${actor}' cannot perform ${key}. Allowed: ${rule.actor.join(', ')}`);
  }

  // ROLE ENFORCEMENT - CRITICAL
  // Only the assigned role can claim (ready→active)
  if (key === 'ready->active') {
    if (actor !== currentRole && actor !== 'system') {
      throw new Error(
        `Role mismatch: Only role '${currentRole}' can claim this task. ` +
        `Actor '${actor}' attempted to claim.`
      );
    }
  }

  return {
    allowed: true,
    setRole: rule.setRole,
    message: `Transition ${key} allowed for actor ${actor}`
  };
}
```

**Integration in interface-cli.js transition command:**

```javascript
function cmdTransition(id, newStatus, actor) {
  const node = getNode(id);
  const dna = JSON.parse(node.dna_json);
  const currentRole = dna.role || 'system';

  // Call validator with role enforcement
  const result = validateTransition(
    node.type,
    node.status,
    newStatus,
    actor,
    currentRole
  );

  // If setRole is specified, update the DNA
  if (result.setRole) {
    dna.role = result.setRole;
    updateDna(id, { role: result.setRole });
  }

  // Proceed with transition
  performTransition(node.id, newStatus);
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

### Viz Status Visibility (NEW - Iteration 5)

**Requirement:** Visualization must show ALL 10 statuses.

**Current gap:** Active nodes fall through filter - not in queue, not in post-work.

**Status Colors:**

| Status | Color | Hex | Section |
|--------|-------|-----|---------|
| pending | Gray | #6b7280 | QUEUE |
| ready | Blue | #3b82f6 | QUEUE |
| active | Green | #22c55e | **ACTIVE (new section)** |
| approval | Amber | #f59e0b | AWAITING |
| approved | Purple | #8b5cf6 | AWAITING |
| review | Orange | #f97316 | IN REVIEW |
| rework | Red | #ef4444 | IN REVIEW |
| complete | Teal | #14b8a6 | DONE |
| blocked | Dark Red | #dc2626 | BLOCKED |
| cancelled | Light Gray | #9ca3af | DONE |

**Viz sections (5):**
1. **ACTIVE** - nodes being worked on (active)
2. **QUEUE** - available nodes (pending, ready)
3. **AWAITING** - waiting for human action (approval, approved)
4. **IN REVIEW** - QA phase (review, rework)
5. **DONE** - finished or cancelled (complete, blocked, cancelled)

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

## MIGRATION CHAPTER (NEW - Iteration 7)

**Principle:** System cannot enforce rules that break existing data. Migrate first, then enforce.

**Context:** Workflow engine only allows type=task and type=bug, but database has existing types (design, requirement, test, etc.). This task itself had type=design before migration.

### Step 1: Find All Existing Non-Task/Bug Types

```sql
-- Query to find ALL nodes with invalid types
SELECT id, slug, type, status, created_at
FROM mindspace_nodes
WHERE type NOT IN ('task', 'bug')
ORDER BY type, created_at;
```

**Expected types to find:** design, requirement, test, feature, etc.

### Step 2: Migration Script

```sql
-- Migration: Convert all non-task/bug types to task
-- Run this BEFORE enabling type validation

-- Convert design → task
UPDATE mindspace_nodes SET type = 'task' WHERE type = 'design';

-- Convert requirement → task
UPDATE mindspace_nodes SET type = 'task' WHERE type = 'requirement';

-- Convert test → task
UPDATE mindspace_nodes SET type = 'task' WHERE type = 'test';

-- Convert any other types → task
UPDATE mindspace_nodes SET type = 'task' WHERE type NOT IN ('task', 'bug');
```

**Alternative: JavaScript migration via interface-cli.js**

```javascript
// node src/db/migrate-types.js
const db = require('better-sqlite3')('data/xpollination.db');

const invalidTypes = db.prepare(`
  SELECT id, slug, type FROM mindspace_nodes
  WHERE type NOT IN ('task', 'bug')
`).all();

console.log(`Found ${invalidTypes.length} nodes to migrate`);

const update = db.prepare(`UPDATE mindspace_nodes SET type = 'task' WHERE id = ?`);

for (const node of invalidTypes) {
  console.log(`Migrating ${node.slug}: ${node.type} → task`);
  update.run(node.id);
}

console.log('Migration complete');
db.close();
```

### Step 3: Verification Query

```sql
-- Verify NO invalid types remain after migration
SELECT type, COUNT(*) as count
FROM mindspace_nodes
GROUP BY type;

-- Expected result:
-- task | N
-- bug  | M
-- (no other types should appear)
```

### Step 4: Order of Operations

**CRITICAL: Migration MUST run BEFORE validation enforcement.**

```
1. Run migration script (convert all types to task/bug)
2. Verify migration complete (no invalid types)
3. Deploy TypeValidator code
4. Enable validation enforcement
```

If validation is enabled before migration, existing tasks will fail operations.

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
10. **Viz: Show all 10 statuses** - add ACTIVE section, AWAITING section, color all statuses
11. **Type migration** - run migration script BEFORE enabling TypeValidator
12. **BUG FIX: review→rework must set newRole: dev** - Found by QA 2026-02-04. When QA sends task back for rework, the role must change to dev so dev agent can pick it up. Add `newRole: 'dev'` to `review->rework` transition in ALLOWED_TRANSITIONS for both task and bug types.
13. **BUG FIX: Dev monitor must check status='rework'** - Found 2026-02-04. **FIXED by PDSA agent (commit cfb252e)**. Dev agent monitor (viz/agent-monitor.cjs) only checks `status='ready'` but dev also needs to see `status='rework'` tasks (sent back by QA). Fix: add role-aware status checking for dev role: `const statuses = role === 'dev' ? ['ready', 'rework'] : ...`. Pattern matches QA monitor fix that checks both 'ready' and 'review'.

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
