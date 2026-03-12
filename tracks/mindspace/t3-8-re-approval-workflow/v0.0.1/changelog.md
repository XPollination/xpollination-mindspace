# Changelog: t3-8-re-approval-workflow v0.0.1

## v0.0.1 — 2026-03-12

Initial implementation.

### Changes
- New re-approval.ts service: createReApprovalRequest() and approveReApproval()
- Creates approval_request linked to suspect via suspect_link_id
- Broadcasts RE_APPROVAL_NEEDED SSE event on creation
- approveReApproval() marks approval as approved and clears linked suspect link (status→cleared)
- Migration 032: adds type and suspect_link_id columns to approval_requests table

### Tests
- 3/3 passing (api/__tests__/t3-8-re-approval-workflow.test.ts)
