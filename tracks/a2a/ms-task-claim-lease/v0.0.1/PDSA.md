# PDSA: Task Claim with Lease Token

**Task:** ms-task-claim-lease
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.20 Phase 7.4

## Problem

No proof of task assignment. Two agents could claim the same task. No auto-release on disconnect.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Claim-task returns lease token (proof of assignment) | Prevents duplicate claims |
| D2 | Lease TTL: 30 min, renewed by heartbeat | Auto-release on disconnect |
| D3 | Wire agent-bond.ts (createBond/renewBond/expireBond) with task-claiming.ts | Code exists, needs wiring |
| D4 | Heartbeat renews lease automatically | Agent stays active as long as heartbeat alive |
| D5 | Expired lease → task returns to ready status | Available for re-claim |

### Acceptance Criteria

- AC1: Claiming a task returns a lease token
- AC2: Claiming an already-claimed task is rejected
- AC3: Lease expires after TTL without heartbeat renewal
- AC4: Expired lease releases task back to ready
- AC5: Heartbeat renews lease TTL

### Files to Change

- `api/routes/task-claiming.ts` — Wire bond creation on claim
- `api/routes/task-heartbeat.ts` — Wire bond renewal on heartbeat

## Do / Study / Act

(To be completed)
