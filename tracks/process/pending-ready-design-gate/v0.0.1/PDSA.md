# PDSA: pending→ready design gate for dev tasks

**Task:** pending-ready-design-gate
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

LIAISON can transition a task from `pending→ready` with `role=dev`, skipping the PDSA design phase entirely. DEV then receives a task with no findings, no pdsa_ref, no qa_tests — and correctly refuses to claim it. The engine should prevent this at the gate level.

## Investigation

### Current state

The `pending->ready` transition in `workflow-engine.js`:
```javascript
'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'] },
```

No `requiresDna` gate exists. The dependency gate in `interface-cli.js` (line ~530) only checks that dependent tasks are complete — it doesn't check for design artifacts.

### Existing gate pattern

The engine already uses `requiresDna` for other transitions:
- `ready->active` requires `memory_query_session`
- `active->approval` requires `pdsa_ref` and `memory_contribution_id`
- `review->rework` requires `rework_target_role`

### The conditional requirement

Not all `pending→ready` transitions need design artifacts:
- **`role=pdsa`**: Task IS the design work — no prior design needed
- **`role=dev`**: Task needs PDSA design first — require `pdsa_ref` or `findings`
- **`role=qa`**: Similar to dev — should have design context
- **`role=liaison`**: Liaison tasks (content path) don't follow PDSA design flow

So the gate is **role-conditional**: only enforce for `role=dev` (and optionally `role=qa`).

### Implementation options

**Option A: Role-specific transition rules** — Add `pending->ready:dev` with `requiresDna: ['pdsa_ref']`. This follows the existing pattern of role-specific rules like `ready->active:dev`.

**Option B: Conditional gate in interface-cli.js** — Add logic next to the dependency gate. More flexible but harder to test in isolation.

**Chosen: Option A** — follows existing engine patterns, testable via `validateDnaRequirements()`, minimal code change.

## Design

### File 1: `src/db/workflow-engine.js` (update)

Add role-specific rules for `pending->ready` where the task role matters:

```javascript
// Current:
'pending->ready': { allowedActors: ['liaison', 'system', 'pdsa'] },

// Add role-specific gate:
'pending->ready:dev': { allowedActors: ['liaison', 'system', 'pdsa'], requiresDna: ['pdsa_ref'] },
```

When a task with `role=dev` transitions from `pending→ready`, the engine checks for `pending->ready:dev` first (since `currentRole` is `dev`), finds `requiresDna: ['pdsa_ref']`, and rejects if missing.

Tasks with `role=pdsa` fall through to the base `pending->ready` rule (no `requiresDna`), which is correct — PDSA tasks don't need a prior PDSA design.

### File 2: `src/db/workflow-engine.js` — `validateDnaRequirements` already handles role-specific lookups

The existing logic at line 276-278 already checks role-specific rules:
```javascript
if (currentRole) {
  rule = typeTransitions[`${transitionKey}:${currentRole}`];
}
```

No change needed in the validation function — it already supports this pattern.

### Bug gate also needs updating

The `bug` type transitions also have `pending->ready` without a design gate. Since bugs go directly to dev, they don't need PDSA design — this is intentional. No change needed for bugs.

## Files Changed

1. `src/db/workflow-engine.js` — add `pending->ready:dev` rule with `requiresDna: ['pdsa_ref']`

## Testing

1. `pending->ready` with `role=pdsa` succeeds without `pdsa_ref` (PDSA tasks don't need prior design)
2. `pending->ready` with `role=dev` fails without `pdsa_ref` in DNA
3. `pending->ready` with `role=dev` succeeds when `pdsa_ref` is set in DNA
4. `pending->ready` with `role=liaison` succeeds without `pdsa_ref` (liaison content path)
5. `pending->ready` with `role=qa` — consider whether to gate (recommended: add `pending->ready:qa` with `requiresDna: ['pdsa_ref']` too, since QA testing tasks should have a design spec)
6. Bug type `pending->ready` still works without `pdsa_ref` (bugs don't follow PDSA)
7. Error message clearly states "pdsa_ref required for dev tasks"
8. Allowed actors unchanged: liaison, system, pdsa can all trigger the transition
