# Changelog: workflow-complete-role-reset v0.0.2

## v0.0.2 — 2026-03-10

**Rework of v0.0.1** — redesigned from safety-net (silent correction) to enforcement (reject invalid transitions).

### What changed from v0.0.1

| Aspect | v0.0.1 (rejected) | v0.0.2 (current) |
|--------|-------------------|-------------------|
| Approach | Safety net: force `role=liaison` on complete | Enforcement: REJECT transition if role is wrong |
| Scope | Only `complete` state | All fixed-role states (complete, approval, approved, testing, cancelled) |
| Behavior | Silently corrects invalid role | Returns error, forces agent/developer to fix the transition rule |
| Design principle | Janitor (clean up after violations) | Gate (prevent violations from occurring) |

### Changes

1. **New:** `EXPECTED_ROLES_BY_STATE` constant in workflow-engine.js — maps fixed-role states to their expected roles
2. **New:** `validateRoleConsistency()` function in workflow-engine.js — validates effective role against state expectations
3. **New:** Enforcement gate in interface-cli.js cmdTransition — calls validateRoleConsistency before DB write
4. **Modified:** `any->cancelled:system` gets explicit `newRole: 'liaison'` (was undefined, now consistent)
5. **Unchanged:** Migration script for 69 historical tasks (data repair is distinct from enforcement)
6. **Updated:** WORKFLOW.md v16 → v17

### Rework feedback (verbatim from Thomas)

> "FULL REWORK. Wrong approach: the safety net silently corrects role on complete transition, which MASKS workflow violations. [...] We need ENFORCEMENT, not correction."
