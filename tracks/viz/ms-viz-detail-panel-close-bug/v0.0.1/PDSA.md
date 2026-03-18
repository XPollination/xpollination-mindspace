# PDSA: Bug — Detail Panel Reopens After Closing

**Task:** ms-viz-detail-panel-close-bug
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 bugfix

## Problem

Detail panel reopens immediately after closing. ETag polling (every 5s) calls renderBoard() which re-applies selected state, triggering showTaskDetail() again. Close clears selection but next poll re-renders with task still selected.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Close handler must clear selectedTaskSlug in application state | Prevent re-selection on render |
| D2 | renderBoard() must check if selectedTaskSlug is null before opening detail | Don't auto-open panel on poll |
| D3 | ETag poll should update data without re-triggering UI selection | Data refresh ≠ UI interaction |
| D4 | Separate data update from UI state (selected task, scroll position, panel open/closed) | Architecture fix |

### Acceptance Criteria

- AC1: Closing detail panel stays closed across poll cycles
- AC2: Clicking a different task opens that task's detail
- AC3: ETag polling updates task data without reopening panel
- AC4: Reopening detail panel after close works correctly

### Files to Change

- `viz/versions/v0.0.X/index.html` — Fix close handler + renderBoard selection logic

### Test Plan

1. Click task → panel opens
2. Close panel → stays closed for >10s (2+ poll cycles)
3. Click different task → that task's detail opens
4. Close → stays closed

## Do / Study / Act

(To be completed)
