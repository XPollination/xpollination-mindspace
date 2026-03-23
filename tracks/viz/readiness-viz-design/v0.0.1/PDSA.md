# PDSA: Readiness Status Display in Mission Document Pages

**Task:** readiness-viz-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-OG-005

## Problem

No visual indication of object readiness in the viz. After implementing CONFIRMS_READY in SpiceDB, users and agents need to see which capabilities/requirements are confirmed ready.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Show readiness on both mission map cards AND document pages | Cards show aggregate %, pages show per-capability detail. Overview + drill-down. |
| D2 | Sequential confirmation (not batch) | Each requirement needs individual review. Batch skips diligence. |

### Mission Map Card Enhancement

Add readiness bar below cap count badge:
```
┌──────────────────┐
│ Mission Title    │
│ Description...   │
│ [4 caps] [active]│
│ ████░░░ 60% ready│  ← new
└──────────────────┘
```

### Document Page: Capability Readiness

```
## CAP-AUTH: Authentication & Authorization
Status: active | Readiness: ██████░░ 75% (3/4 requirements confirmed)

Requirements:
  ✅ REQ-AUTH-001: API Key Management (confirmed by agent-qa, 2h ago)
  ✅ REQ-AUTH-002: JWT Session (confirmed by agent-qa, 2h ago)
  ✅ REQ-AUTH-003: OAuth Integration (confirmed by agent-pdsa, 5h ago)
  ⬜ REQ-AUTH-004: Role-Based Access (pending — click to review)

  [Confirm REQ-AUTH-004 →]
```

### Readiness Data Source

Query SpiceDB for CONFIRMS_READY relationships:
```javascript
// For each capability: count confirmed vs total requirements
const confirmed = await spicedb.lookupResources('requirement', 'is_ready', `agent:${agentId}`);
const total = db.prepare('SELECT COUNT(*) FROM requirements WHERE capability_id = ?').get(capId);
const percent = Math.round((confirmed.length / total.c) * 100);
```

### Confirmation Flow

Click "Confirm REQ-XXX" → modal with requirement content → "Confirm Ready" button → POST /a2a/confirm_ready → badge updates to ✅.

### Color Scale

| Readiness | Color | Meaning |
|-----------|-------|---------|
| 0% | `#e53e3e` (red) | No requirements confirmed |
| 1-49% | `#dd6b20` (orange) | In progress |
| 50-99% | `#d69e2e` (yellow) | Mostly ready |
| 100% | `#38a169` (green) | Fully confirmed |

### Acceptance Criteria

- AC1: Mission map cards show readiness percentage bar
- AC2: Document page shows per-requirement confirmation status
- AC3: Confirmed requirements show ✅ with agent and timestamp
- AC4: Pending requirements are clickable for confirmation
- AC5: Color scale reflects readiness percentage
- AC6: Auto-cascade: capability shows 100% when all requirements confirmed

### Test Plan

api/__tests__/readiness-viz.test.ts
