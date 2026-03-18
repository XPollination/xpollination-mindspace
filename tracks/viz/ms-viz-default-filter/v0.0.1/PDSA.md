# PDSA: Viz Default Status Filter — Show Active Pipeline

**Task:** ms-viz-default-filter
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001

## Problem

Viz Kanban loads with All tasks (395+) including completed/cancelled/blocked. Overwhelming. Default should show the active pipeline only.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Default filter: pending, ready, active, approval, approved, testing, review, rework | Active pipeline statuses |
| D2 | Excluded by default: complete, cancelled, blocked | Done or stuck — not actionable |
| D3 | User can switch to All or specific status views | No functionality removed |
| D4 | Use version-bump.sh for new viz version | Mandatory per version bump gate |
| D5 | Change default filter state in index.html JavaScript | Minimal code change |

### Acceptance Criteria

- AC1: Viz loads with active pipeline statuses visible by default
- AC2: Complete/cancelled/blocked tasks hidden on initial load
- AC3: User can still view all statuses by changing filter
- AC4: Task count reflects filtered view
- AC5: New viz version created via version-bump.sh

### Files to Change

- `viz/versions/v0.0.X/index.html` — Change default filter state

### Test Plan

1. Open Viz → verify only active pipeline tasks visible
2. Switch to "All" → verify complete/blocked/cancelled appear
3. Verify task count matches filter

## Do / Study / Act

(To be completed)
