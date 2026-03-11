# PDSA: Re-Approval Workflow for Changed Verification Basis

**Task:** t3-8-re-approval-workflow
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

When propagation (t3-3 top-down or t3-4 bottom-up) creates suspect links and invalidates attestations, automatically trigger a human re-approval workflow. Thomas is notified with context about what changed and why. Approval clears the suspect link.

### Existing Infrastructure

- **Suspect links**: `suspect_links` table + `suspect-links.ts` routes (CRUD, status update, stats)
- **Approval requests**: `approval_requests` table + `approval-requests.ts` routes (list, approve, reject)
- **Top-down propagation**: `propagateRequirementChange()` — invalidates attestations, creates suspect links
- **Bottom-up propagation**: `propagateTestChange()` — invalidates attestations, creates suspect links, creates approval_requests
- **SSE**: `sendToAgent()` for TASK_APPROVED/TASK_REJECTED events

### Current Gap

Bottom-up propagation (t3-4) already creates approval_requests — but there's no:
1. Notification to Thomas (human) about the re-approval need
2. Viz UI for reviewing and approving/rejecting suspect links
3. Connection between approving an approval_request and clearing the suspect link
4. Top-down propagation does NOT create approval_requests (only creates suspect links)

### Design

#### 1. Auto-Create Approval Request on Suspect Link Creation

Add a service function `createReApprovalRequest()` called from both propagation flows:

```ts
// api/services/re-approval.ts
export function createReApprovalRequest(suspectLink: SuspectLink, context: {
  project_slug: string;
  reason: string;
  source_description: string;  // e.g., "Requirement REQ-TRACE-001 changed to v2"
}): string {
  // 1. Create approval_request linked to the suspect_link
  // 2. Return approval_request.id
}
```

Fields:
- `type`: 're-approval' (new type vs existing 'task' approval)
- `suspect_link_id`: links to the suspect link
- `reason`: human-readable description of the change
- `status`: 'pending'

#### 2. Clear Suspect Link on Approval

Enhance `PUT /:approvalId/approve` in `approval-requests.ts`:

```ts
// After setting approval status to 'approved':
if (request.type === 're-approval' && request.suspect_link_id) {
  db.prepare(
    "UPDATE suspect_links SET status = 'cleared', cleared_by = ?, cleared_at = datetime('now') WHERE id = ?"
  ).run(approved_by, request.suspect_link_id);
}
```

#### 3. Integrate into Propagation Flows

Update `topdown-propagation.ts` to call `createReApprovalRequest()` for each new suspect link (currently only bottom-up does this).

#### 4. Human Notification via SSE

Broadcast `RE_APPROVAL_NEEDED` SSE event when re-approval request is created:

```ts
broadcast('RE_APPROVAL_NEEDED', {
  approval_request_id,
  suspect_link_id,
  reason,
  source_description,
  project_slug
});
```

The viz dashboard already listens for SSE events — it can show a notification badge.

### Migration

Add `suspect_link_id` and `type` columns to `approval_requests` if not already present:

```sql
ALTER TABLE approval_requests ADD COLUMN type TEXT DEFAULT 'task';
ALTER TABLE approval_requests ADD COLUMN suspect_link_id TEXT REFERENCES suspect_links(id);
```

### Files to Change

1. `api/services/re-approval.ts` — CREATE: `createReApprovalRequest()` function
2. `api/routes/approval-requests.ts` — UPDATE: Enhance approve handler to clear suspect link
3. `api/services/topdown-propagation.ts` — UPDATE: Call `createReApprovalRequest()` for each suspect link
4. `api/db/migrations/032-re-approval-columns.sql` — CREATE: Add type + suspect_link_id to approval_requests

### Out of Scope

- Viz UI for reviewing re-approvals (future task)
- Automated re-testing pipeline (manual human review only)

## Do

Implementation by DEV agent.

## Study

- Re-approval request created when propagation creates suspect links
- Approving the request clears the associated suspect link
- Both top-down and bottom-up flows trigger re-approval
- RE_APPROVAL_NEEDED SSE event broadcast
- Migration adds columns without breaking existing approval flow

## Act

Test with both propagation flows on TEST (:4200).
