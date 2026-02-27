# PDSA: Workflow - LIAISON Content Path

**Date:** 2026-02-05
**Task:** workflow-liaison-content-path
**Status:** Design Complete

---

## PLAN

### Problem
Content tasks (role=liaison) incorrectly go through PDSA workflow:
- Current: `pending->ready` sets `newRole: pdsa` for ALL tasks
- Content tasks (content-hero, content-why, etc.) get assigned to PDSA
- But LIAISON should write content directly, not PDSA

### Discovered Context
HomePage project: content-hero task created with role=liaison but pending->ready changed it to pdsa. Content tasks need their own workflow path.

---

## DO

### Solution: Role-Preserving Transitions

#### Option A: Role-Based newRole (Recommended)
Make pending->ready preserve the original role:

```typescript
'pending->ready': {
  allowedActors: ['liaison', 'system'],
  // Don't force newRole - keep original role
  // OR set dynamically:
  newRole: (task) => task.dna?.role || 'pdsa'
},
```

#### Option B: Separate Liaison Path
Add liaison-specific transitions:

```typescript
'pending->ready:liaison': {
  allowedActors: ['liaison'],
  requireRole: 'liaison',
  newRole: 'liaison'
},
'ready->active:liaison': {
  allowedActors: ['liaison'],
  requireRole: 'liaison'
},
'active->review:liaison': {
  allowedActors: ['liaison'],
  newRole: 'qa'  // QA reviews content
},
```

### Recommended: Option A (Simpler)

The cleanest fix is to NOT override the role on pending->ready:

```typescript
// Current (problematic)
'pending->ready': { allowedActors: ['liaison', 'system'], newRole: 'pdsa' },

// Fixed
'pending->ready': { allowedActors: ['liaison', 'system'] },
// Let the task keep its original role
```

Then liaison tasks stay role=liaison, pdsa tasks stay role=pdsa.

### Content Task Flow

With the fix:
1. **pending->ready**: LIAISON moves task, role stays `liaison`
2. **ready->active**: LIAISON claims task
3. **active->review**: LIAISON completes, goes to QA
4. **review->complete**: QA approves content

---

## STUDY

### Benefits
- Simple fix - remove newRole from pending->ready
- Original role preserved
- Each role's tasks flow correctly
- No complex role-specific transition paths needed

### Trade-offs
- May need to audit existing pending->ready calls
- Tasks without explicit role will have no role after ready

---

## ACT

### Acceptance Criteria

- [ ] AC1: Remove newRole from pending->ready transition
- [ ] AC2: LIAISON tasks keep role=liaison through workflow
- [ ] AC3: PDSA tasks keep role=pdsa through workflow
- [ ] AC4: Add test: liaison content task flow
- [ ] AC5: Verify existing workflows still work (dev tasks)

### Files to Modify
- `src/workflow/transitions.ts` - Update pending->ready

### Implementation
```typescript
// In transitions.ts, change:
'pending->ready': { allowedActors: ['liaison', 'system'], newRole: 'pdsa' },

// To:
'pending->ready': { allowedActors: ['liaison', 'system'] },
// Tasks keep their original role
```

### Next Steps
1. Thomas approves
2. Dev implements
3. QA verifies all role workflows work correctly
