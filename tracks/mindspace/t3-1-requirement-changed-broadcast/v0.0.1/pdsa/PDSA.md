# PDSA: REQUIREMENT_CHANGED Broadcast Message in A2A Protocol

**Date:** 2026-03-11
**Task:** t3-1-requirement-changed-broadcast
**Capability:** suspect-traceability
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** t2-1-attestation-message (attestation SSE events), ms-a11-6-task-available (TASK_AVAILABLE broadcast pattern)

## Plan

### Problem

When a requirement version changes, downstream artifacts (code, tests, attestations) may be invalidated. Currently there is no notification mechanism — agents and nodes discover stale requirements only when they happen to check. A broadcast message ensures all connected agents are immediately aware of requirement changes.

### Evidence

1. **Task DNA** — "When a requirement version changes, broadcast REQUIREMENT_CHANGED to all connected nodes. Nodes mark their local attestations as suspect."
2. **SSE broadcast** — `broadcast(event, data)` in sse-manager.ts already supports arbitrary events.
3. **TASK_AVAILABLE pattern** — broadcast on task unclaim, same pattern applies here.

### Design

#### REQ-REQCHANGE-001: Broadcast on Requirement Update

When a requirement's version is updated (PUT /api/requirements/:id with new version):
1. Broadcast `REQUIREMENT_CHANGED` SSE event to all connected agents
2. Payload: `{ requirement_id, old_version, new_version, project_slug, changed_by, changed_at }`

#### REQ-REQCHANGE-002: Suspect Marking Trigger

The broadcast payload includes a `suspect_scope` field listing which artifact types may be affected:
```json
{
  "suspect_scope": ["attestations", "tests", "implementations"],
  "action_required": "re-validate or re-attest affected artifacts"
}
```

Actual suspect link creation is handled by t3-2/t3-3 (separate tasks). This task only broadcasts the notification.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/requirements.ts` | UPDATE | Add broadcast after requirement version update |

### NOT Changed

- Requirement CRUD — unchanged (add broadcast hook only)
- SSE infrastructure — unchanged
- Suspect link creation — separate task (t3-2, t3-3)
- Attestation validation — unchanged

### Risks

1. **Missing requirements route** — If requirements CRUD doesn't exist yet, need to create it. Check codebase.
2. **Broadcast flood** — Bulk requirement updates could generate many events. Acceptable: each is a small JSON payload.

## Do

### File Changes

#### 1. `api/routes/requirements.ts` (UPDATE or CREATE)

After requirement version update:
```typescript
import { broadcast } from '../lib/sse-manager.js';

// After successful version update:
broadcast('REQUIREMENT_CHANGED', {
  requirement_id: req.id,
  old_version: oldVersion,
  new_version: newVersion,
  project_slug: req.project_slug,
  changed_by: user.id,
  changed_at: new Date().toISOString(),
  suspect_scope: ['attestations', 'tests', 'implementations'],
  action_required: 're-validate or re-attest affected artifacts'
});
```

## Study

### Test Cases (4)

1. Updating requirement version broadcasts REQUIREMENT_CHANGED event
2. Broadcast payload includes old_version and new_version
3. Broadcast payload includes suspect_scope array
4. Non-version updates (e.g., description change) do NOT trigger broadcast

## Act

- Broadcast working → agents immediately know about requirement changes
- Combined with suspect links (t3-2) → full traceability chain
- Future: filter broadcast to only agents working on affected project
