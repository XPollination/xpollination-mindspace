# PDSA: Bottom-up Suspect Propagation

**Task:** t3-4-bottomup-propagation
**Version:** v0.0.1
**Status:** Design
**Depends on:** t3-2-suspect-link-table (complete), ms-a9-1-approval-requests (complete)

## Plan

When a test that verifies a requirement is modified, the verification basis has changed. The requirement needs human re-approval. This creates a suspect link and triggers a time-bonded approval request.

### Problem

Currently, test changes don't propagate upward. A modified test may no longer verify what the original attestation claimed. Without bottom-up propagation, attestations remain "valid" despite changed verification basis.

### Trigger

A test file change is detected (via git commit hook, CI event, or manual API call) that references a requirement through an existing attestation.

### Design (2 files)

#### 1. Bottom-up propagation service (api/services/bottomup-propagation.ts)

New service with one function:

```ts
export function propagateTestChange(params: {
  test_ref: string;        // e.g., "viz/t2-4-transition-gate.test.ts"
  project_slug: string;
  changed_by: string;      // agent or user who changed the test
  reason?: string;         // e.g., "test file modified in commit abc123"
}): PropagationResult
```

**Logic:**
1. Find all attestations that reference this test (`test_ref` in `submitted_checks` JSON or `task_slug` matching)
2. For each attestation found:
   a. Mark attestation as `valid = 0` (invalidated)
   b. Find the requirement(s) the attestation covers (from attestation's `task_id` → task DNA → `requirement_refs`)
   c. Create a suspect link: `source_type='test', source_ref=test_ref, target_type='requirement', target_ref=req_id, reason='Test modified: {reason}', status='suspect'`
3. Create an approval request for each affected requirement (using existing `approval_requests` table):
   - `task_id` = the task that owns the attestation
   - `status = 'pending'`
   - `reason = 'Verification basis changed: test {test_ref} modified'`
4. Return `{ invalidated_attestations: number, suspect_links_created: number, approval_requests_created: number }`

#### 2. Bottom-up propagation route (api/routes/propagation.ts)

```
POST /api/projects/:slug/propagation/test-change
Body: { test_ref, changed_by, reason? }
Response: { invalidated_attestations, suspect_links_created, approval_requests_created }
```

Returns 200 with counts. Returns 404 if no attestations reference the test (no-op, nothing to propagate).

### Existing Infrastructure Used

- `suspect_links` table (t3-2): stores the suspect link records
- `approval_requests` table (ms-a9-1): stores the re-approval requests
- `attestations` table (t2-4): query and invalidate existing attestations
- `sendToAgent()` SSE: notify affected agents of suspect status

### Files to Create/Change

1. `api/services/bottomup-propagation.ts` — CREATE: propagation logic
2. `api/routes/propagation.ts` — CREATE: HTTP endpoint

### No Migration Needed

Uses existing tables: `attestations`, `suspect_links`, `approval_requests`.

## Do

Implementation by DEV agent.

## Study

- Verify test change creates suspect links for all affected requirements
- Verify attestations are invalidated (valid = 0)
- Verify approval requests are created
- Verify no-op when test has no attestations
- Verify propagation count return values

## Act

Integrate with t3-3 (top-down propagation) for bidirectional traceability.
