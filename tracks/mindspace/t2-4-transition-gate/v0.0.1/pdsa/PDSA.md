# PDSA: Attestation as Transition Gate

**Date:** 2026-03-11
**Task:** t2-4-transition-gate
**Capability:** attestation-traceability
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** t2-2-rules-engine (attestation-rules.ts), ms-a9-1-approval-requests (approval gate pattern)

## Plan

### Problem

Task transitions (e.g., active → review, review → complete) currently have no attestation requirement. An agent can transition without proving it completed required checks. The attestation system exists (POST /validate) but is not integrated into the transition engine. Transitions that require attestation should be blocked until a valid attestation is provided.

### Evidence

1. **Task DNA** — "Integrate attestation validation into the transition engine. Transitions that require attestation are blocked until a valid attestation is provided."
2. **Existing pattern** — Approval gate already blocks transitions until human approves. Attestation gate follows the same architecture.
3. **interface-cli.js transition** — has gate checks (memory_query_session, memory_contribution_id). Attestation is another gate.

### Design

#### REQ-ATTEST-GATE-001: Attestation Gate in Transition Engine

Add to the transition engine:

For configured transitions (e.g., `active → review`):
1. Check if the task's project+capability has attestation rules configured (t2-3-rules-config)
2. If rules exist, check if a valid attestation exists for this task+transition
3. If no valid attestation, block transition with error: "Attestation required for this transition"
4. If valid attestation exists, allow transition

#### REQ-ATTEST-GATE-002: Attestation Record Table

```sql
CREATE TABLE attestations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  transition TEXT NOT NULL,
  rules_version INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('pass','fail')),
  details JSON,
  attested_by TEXT NOT NULL,
  attested_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
CREATE INDEX idx_attestations_task ON attestations(task_id);
```

#### REQ-ATTEST-GATE-003: Gate Check Function

```typescript
function checkAttestationGate(db, taskId, transition): { allowed: boolean; reason?: string }
```

Called by the transition engine before executing the transition. Returns `allowed: true` if:
- No attestation rules configured for this project → gate bypassed
- Valid attestation exists with `result = 'pass'` and matching `rules_version`

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/db/migrations/030-attestations.sql` | CREATE | Attestation records table |
| 2 | `api/services/attestation-gate.ts` | CREATE | checkAttestationGate function |
| 3 | `src/db/workflow-engine.js` | UPDATE | Add attestation gate check before transition |

### NOT Changed

- Existing gates (approval, memory) — unchanged
- Attestation validation endpoint — unchanged (agents still call POST /validate separately)
- Transition CLI interface — unchanged

### Risks

1. **Blocking existing workflows** — If attestation rules get configured prematurely, all transitions block. Mitigated: gate only activates when rules are explicitly configured per project.
2. **Rules version mismatch** — Agent attests against old rules, new rules deployed. v0.0.1: warn but don't block.

## Do

### File Changes

As described in design. Migration creates attestations table, gate service checks validity, workflow engine calls gate.

## Study

### Test Cases (6)

1. Transition allowed when no attestation rules configured (gate bypassed)
2. Transition blocked when rules exist but no attestation provided
3. Transition allowed when valid attestation with matching rules_version exists
4. Failed attestation (result='fail') does not satisfy gate
5. Gate returns clear error message with required attestation info
6. Existing transitions without attestation rules continue to work

## Act

- Attestation gate working → configurable quality gates per project
- Combined with rules-config (t2-3) → full attestation pipeline
- Future: auto-reject transitions with stale rules_version attestations
