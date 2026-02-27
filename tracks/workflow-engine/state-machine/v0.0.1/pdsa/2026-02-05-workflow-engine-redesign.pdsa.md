# PDSA: Workflow Engine Redesign - Complete Role-Based Transitions

**Date:** 2026-02-05
**Task:** workflow-engine-redesign
**Status:** Design Complete (Consolidated)

---

## PLAN

### Scope
Consolidated redesign combining all identified workflow issues:
1. [workflow-pdsa-rework-path](2026-02-05-workflow-pdsa-rework-path.pdsa.md)
2. [workflow-liaison-content-path](2026-02-05-workflow-liaison-content-path.pdsa.md)
3. [workflow-qa-test-loop](2026-02-05-workflow-qa-test-loop.pdsa.md)
4. Plus: ready→active role matching, approval role enforcement

### Current Problems
1. `pending→ready` ALWAYS sets role=pdsa (breaks liaison content tasks)
2. `rework→active` only allows dev (pdsa cannot claim rework)
3. `ready→active` only allows pdsa (others cannot claim tasks)
4. `active→review` only allows dev (pdsa/liaison cannot submit)
5. `approval` does not enforce role=liaison
6. QA missing from loop (no test creation phase before dev)

---

## DO

### Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DESIGN PATH (role: pdsa)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  pending ──┬──► ready(pdsa) ──► active(pdsa) ──► review(liaison)        │
│            │                                          │                  │
│            │                                          ▼                  │
│            │                                    approval(human)          │
│            │                                          │                  │
│            │                                          ▼                  │
│            │                                    approved                 │
│            │                                          │                  │
│            │                                          ▼                  │
│            │                                    testing(qa) ◄─────────┐ │
│            │                                          │               │  │
│            │                                          ▼               │  │
│            │                                    ready(dev)            │  │
│            │                                          │               │  │
│            │                                          ▼               │  │
│            │                                    active(dev)           │  │
│            │                                          │               │  │
│            │                                          ▼               │  │
│            │                                    review(qa)            │  │
│            │                                          │               │  │
│            │                                    ┌─────┴─────┐         │  │
│            │                                    ▼           ▼         │  │
│            │                               rework(dev)  pdsa-review   │  │
│            │                                    │           │         │  │
│            │                                    └───────────┤         │  │
│            │                                                ▼         │  │
│            │                                          complete        │  │
│            │                                                          │  │
├────────────┴────────────────────────────────────────────────────────────┤
│                      CONTENT PATH (role: liaison)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  pending ──► ready(liaison) ──► active(liaison) ──► review(qa) ──► complete │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Transition Rules

#### 1. pending → ready (FIXED)
**Current (broken):** Forces newRole: 'pdsa'
**Fixed:** Preserve original role

```typescript
'pending->ready': {
  allowedActors: ['liaison', 'system'],
  // NO newRole - preserve original
},
```

#### 2. ready → active (FIXED)
**Current (broken):** Only allows pdsa
**Fixed:** Role-matched actors

```typescript
'ready->active': {
  allowedActors: ['pdsa', 'dev', 'qa', 'liaison'],
  validate: (task, actor) => {
    const taskRole = task.dna?.role;
    if (taskRole && actor !== taskRole) {
      return { valid: false, error: `Actor ${actor} cannot claim ${taskRole} task` };
    }
    return { valid: true };
  }
},
```

#### 3. active → review (FIXED)
**Current (broken):** Only allows dev
**Fixed:** Role-matched actors

```typescript
'active->review': {
  allowedActors: ['pdsa', 'dev', 'liaison'],
  // For PDSA: goes to liaison review
  // For dev: goes to qa test run
  // For liaison: goes to qa content review
},
```

#### 4. rework → active (FIXED)
**Current (broken):** Only allows dev
**Fixed:** Allow pdsa and dev based on role

```typescript
'rework->active': {
  allowedActors: ['pdsa', 'dev'],
  validate: (task, actor) => {
    const taskRole = task.dna?.role;
    if (taskRole && actor !== taskRole) {
      return { valid: false, error: `Actor ${actor} cannot claim ${taskRole} rework` };
    }
    return { valid: true };
  }
},
```

#### 5. review → approval (FIXED)
**Current (broken):** No role enforcement
**Fixed:** Set role to liaison for monitoring

```typescript
'review->approval': {
  allowedActors: ['qa', 'liaison'],
  newRole: 'liaison'  // Liaison monitors approval queue
},
```

#### 6. approved → testing (NEW)
**Added:** QA test creation phase

```typescript
'approved->testing': {
  allowedActors: ['liaison', 'system'],
  newRole: 'qa'
},
```

#### 7. testing → ready (NEW)
**Added:** After QA creates tests, dev can start

```typescript
'testing->ready': {
  allowedActors: ['qa'],
  newRole: 'dev'
},
```

### New Status: testing

Add to valid statuses:
```typescript
export const WORKFLOW_STATES = [
  'pending', 'ready', 'active', 'testing',
  'approval', 'approved', 'review', 'rework',
  'complete', 'blocked', 'cancelled'
];
```

### Role Preservation Principle

> **Tasks should keep their assigned role until explicitly transitioned.**

The role defines WHO works on the task. Transitions should not automatically override roles unless that's the intent (e.g., `testing->ready` explicitly changes to dev).

---

## STUDY

### Benefits
1. **Role-accurate** - Each role can work on their tasks
2. **TDD-enabled** - QA creates tests before dev implements
3. **Content path** - Liaison content tasks flow correctly
4. **Rework works** - PDSA can fix PDSA rework
5. **Traceable** - Clear role at each phase

### Trade-offs
- More complex transition validation
- New status adds workflow states
- May need migration for existing tasks

### Backwards Compatibility
- Existing tasks may have wrong roles
- Consider: migration script to fix roles
- Or: accept current state, fix going forward

---

## ACT

### Acceptance Criteria

**Role Preservation:**
- [ ] AC1: pending→ready preserves original role
- [ ] AC2: ready→active validates actor matches task role
- [ ] AC3: active→review allows pdsa, dev, liaison
- [ ] AC4: rework→active validates actor matches task role

**Approval Phase:**
- [ ] AC5: review→approval sets role=liaison

**Testing Phase:**
- [ ] AC6: Add 'testing' status
- [ ] AC7: approved→testing transition (newRole: qa)
- [ ] AC8: testing→ready transition (newRole: dev)

**Full Paths Work:**
- [ ] AC9: PDSA design path: pending→...→testing→dev→review→complete
- [ ] AC10: LIAISON content path: pending→ready→active→review→complete

### Files to Modify
- `src/workflow/transitions.ts` - All transition changes
- `src/workflow/states.ts` - Add 'testing' status
- `viz/agent-monitor.cjs` - Detect testing status for QA
- `docs/` - Update workflow documentation

### Implementation Order
1. Add 'testing' status
2. Update transition rules (all at once for consistency)
3. Update agent monitor
4. Run tests
5. Update documentation

### Related PDSAs
- [workflow-pdsa-rework-path.pdsa.md](2026-02-05-workflow-pdsa-rework-path.pdsa.md) - Detailed rework analysis
- [workflow-liaison-content-path.pdsa.md](2026-02-05-workflow-liaison-content-path.pdsa.md) - Content path analysis
- [workflow-qa-test-loop.pdsa.md](2026-02-05-workflow-qa-test-loop.pdsa.md) - Testing phase analysis

### Next Steps
1. Thomas approves consolidated design
2. Dev implements ALL changes together
3. QA verifies each path works
4. Update CLAUDE.md with new workflow
