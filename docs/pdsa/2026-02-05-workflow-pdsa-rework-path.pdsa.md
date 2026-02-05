# PDSA: Workflow - PDSA Rework Path

**Date:** 2026-02-05
**Task:** workflow-pdsa-rework-path
**Status:** Design Complete

---

## PLAN

### Problem
When LIAISON sends a PDSA task from approval back to rework, PDSA agent cannot pick it up because:
- Current: `rework->active: { allowedActors: [dev] }`
- Only dev can claim rework tasks, but PDSA tasks need PDSA to rework them

### Discovered Context
HomePage project: pdsa-folder-structure task sent to rework from approval. PDSA couldn't transition rework->active. LIAISON had to use dev actor as workaround.

---

## DO

### Solution: Role-Aware Rework Transition

Add role-based rework transitions in `src/workflow/transitions.ts`:

```typescript
// Current
'rework->active': { allowedActors: ['dev'] },

// Change to role-aware
'rework->active': {
  allowedActors: ['dev', 'pdsa'],
  validate: (task, actor) => {
    // Actor must match task role
    if (task.dna?.role && actor !== task.dna.role) {
      return { valid: false, error: `Actor ${actor} cannot claim ${task.dna.role} task` };
    }
    return { valid: true };
  }
},
```

**Alternative (simpler):** Add pdsa to allowedActors, let monitor/agent self-select by role:
```typescript
'rework->active': { allowedActors: ['dev', 'pdsa'] },
```

### Recommended: Simple Approach
Add pdsa to allowedActors. The agent monitor already filters by role, so:
- PDSA agent only sees pdsa-role tasks
- Dev agent only sees dev-role tasks
- Either can transition rework->active, but they only try for their own role

---

## STUDY

### Benefits
- Simple fix - one line change
- Agent monitors already filter by role
- No complex validation needed

### Trade-offs
- Technically allows dev to claim pdsa task (but why would they?)
- Relies on agent behavior, not enforcement

---

## ACT

### Acceptance Criteria

- [ ] AC1: Add 'pdsa' to allowedActors for 'rework->active' transition
- [ ] AC2: PDSA agent can claim rework tasks when role=pdsa
- [ ] AC3: Dev agent can still claim rework tasks when role=dev
- [ ] AC4: Add test: PDSA role task rework->active with pdsa actor

### Files to Modify
- `src/workflow/transitions.ts` - Add pdsa to rework->active allowedActors

### Implementation
```typescript
// In transitions.ts, update:
'rework->active': { allowedActors: ['dev', 'pdsa'] },
```

### Next Steps
1. Thomas approves
2. Dev implements (one line change + tests)
3. QA verifies workflow path works
