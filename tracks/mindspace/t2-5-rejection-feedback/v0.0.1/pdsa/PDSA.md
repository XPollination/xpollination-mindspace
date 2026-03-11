# PDSA: Attestation Rejection Feedback

**Task:** t2-5-rejection-feedback
**Version:** v0.0.1
**Status:** Design
**Depends on:** t2-4-transition-gate (complete)

## Plan

When attestation is rejected, provide detailed feedback: which checks failed, expected vs actual values, and suggestions for fixing.

### Problem

Current rejection handling is generic:
- `attestation-gate.ts` returns "no valid attestation found" (no specifics)
- `resolveAttestation()` stores `rejection_reason` as a plain text string
- No SSE event notifies agents of rejection details
- Agents cannot self-correct without knowing which checks failed

### Design (3 changes)

#### 1. Structured rejection in `rejectWithFeedback()` (api/lib/attestation.ts)

New function that takes validation results from `validateAttestation()` and stores structured JSON in `rejection_reason`:

```json
{
  "checks_failed": [
    {
      "rule": "tags_present",
      "passed": false,
      "message": "Missing req_id",
      "suggestion": "Add req_id field to attestation payload"
    }
  ],
  "summary": "1 of 4 checks failed"
}
```

Suggestion map (hardcoded per rule):

| Rule | Suggestion |
|------|------------|
| tags_present | Add req_id and task_id fields to attestation payload |
| refs_valid | Ensure task_id references an existing task in the database |
| tests_tagged | Add test_id to all test_results entries |
| commits_formatted | Format commit messages as type(scope): description |

#### 2. ATTESTATION_REJECTED SSE event (api/lib/attestation.ts)

After rejection, emit SSE to the agent via `sendToAgent()`:

```json
{
  "type": "ATTESTATION_REJECTED",
  "attestation_id": "...",
  "task_id": "...",
  "checks_failed": [...],
  "summary": "..."
}
```

#### 3. Enhanced gate feedback (api/services/attestation-gate.ts)

When gate blocks and a rejected attestation exists, include structured rejection reason:

```ts
return {
  allowed: false,
  reason: `Attestation rejected: ${attestation.rejection_reason}`
}
```

When no attestation exists, include which rules are configured for the transition.

### Files to Change

1. `api/lib/attestation.ts` — add `rejectWithFeedback()`, emit ATTESTATION_REJECTED SSE
2. `api/services/attestation-gate.ts` — enhanced rejection reason with structured details
3. `api/services/attestation-rules.ts` — export suggestion map

### No Migration Needed

Existing `rejection_reason TEXT` column stores JSON string (no schema change).

## Do

Implementation by DEV agent.

## Study

- Verify `rejectWithFeedback()` stores JSON in `rejection_reason`
- Verify ATTESTATION_REJECTED SSE event emitted on rejection
- Verify gate returns structured reason when attestation is rejected
- Verify suggestion map covers all 4 rules

## Act

Integrate with remaining T2/T3 traceability tasks.
