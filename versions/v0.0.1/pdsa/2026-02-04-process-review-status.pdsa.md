# PDSA: Add Review Status to Task Workflow

**Date:** 2026-02-04
**Node:** process-review-status (84dbb123-0350-481c-af60-56035695104f)
**Type:** Task
**Status:** ACTIVE

## PLAN

### Objective

Add `review` status to task workflow between `active` and `complete`.

### Current Flow
```
ready → active → complete
```

### Proposed Flow
```
ready → active → review → complete
                   ↓
                 rework → active
```

---

## DO (Findings)

### Status Workflow Update

| Transition | Actor | When |
|------------|-------|------|
| active → review | Dev | Implementation done, needs QA |
| review → complete | PDSA/QA | Verified, all good |
| review → rework | PDSA/QA | Issues found, needs fix |
| rework → active | Dev | Ready to fix |

### Implementation

1. **Viz update:** Add `review` to recognized statuses
2. **CSS:** Add color for review status (amber: `#f59e0b`)
3. **Workflow engine:** Add review as valid status in transition rules

### Acceptance Criteria

- [x] New status: review (between active and complete)
- [x] Dev marks tasks as review when implementation done
- [x] PDSA/Human reviews and marks complete or returns to active

---

## STUDY

Already documented in workflow engine design. Review status enables QA gate.

## ACT

Handoff to dev: Update viz status handling to include `review`.

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-process-review-status.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-process-review-status.pdsa.md
