# PDSA: Object Self-Validation for Readiness Confirmation

**Task:** object-self-validation-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-OG-004

## Problem

No way to confirm knowledge objects are "ready" — requirements have no validation, capabilities can't confirm all requirements are met.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Auto-confirm capability when all requirements confirmed | Reduces manual overhead. Agent visits requirement, confirms, parent auto-cascades. |
| D2 | Adding requirement after confirmation resets capability readiness | Prevents stale confirmations. New requirement = new validation needed. |
| D3 | CONFIRMS_READY relationship in SpiceDB | Queryable, auditable. SpiceDB Check API: "is capability ready?" |

### Confirm Flow

```
1. Agent calls POST /a2a/confirm_ready { object_type, object_id }
2. Server validates:
   - Object exists
   - For requirement: has content_md, has title, status != deprecated
   - For capability: ALL child requirements have CONFIRMS_READY relationship
3. If valid: create CONFIRMS_READY relationship in SpiceDB
4. If capability auto-confirm: check all siblings, auto-confirm parent if all ready
5. Return { confirmed: true, parent_auto_confirmed: bool }
```

### Readiness Reset

```
When new requirement added to capability:
1. Delete CONFIRMS_READY for the capability in SpiceDB
2. Emit READINESS_RESET event via SSE to watching agents
3. Capability status reverts to "needs confirmation"
```

### Requirement Validation Rules

A requirement is confirmable when:
- `title` is non-empty
- `content_md` has >= 100 chars (substantive content)
- `status` is 'active' (not draft or deprecated)
- Has at least 1 linked task (via requirement_refs in DNA)

### SpiceDB Schema Addition

```zed
definition requirement {
  relation capability: capability
  relation project: project
  relation confirmed_by: agent
  permission view = project->view
  permission is_ready = confirmed_by
}
```

### Acceptance Criteria

- AC1: POST /a2a/confirm_ready validates object and creates relationship
- AC2: Capability auto-confirms when all requirements confirmed
- AC3: New requirement resets capability readiness
- AC4: Validation rules enforced (title, content, status, linked tasks)
- AC5: SSE READINESS_RESET event emitted on reset

### Test Plan

api/__tests__/object-self-validation.test.ts
