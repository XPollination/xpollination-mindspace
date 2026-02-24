# PDSA: Fix approval→approved Role Assignment

**Date:** 2026-02-24
**Author:** PDSA Agent
**Task:** fix-approval-approved-role
**Status:** COMPLETE

---

## PLAN

### Bug

`workflow-engine.js` line 51: `approval→approved` transition sets `newRole: 'liaison'`.
WORKFLOW.md v12 line 16 specifies `approved` state monitor = `qa`.

Result: After human approves a design, task stays with liaison. QA never sees it. Task is stuck.

### Fix

Two changes:

1. **`src/db/workflow-engine.js` line 51:**
   ```javascript
   // Before:
   'approval->approved': { allowedActors: ['liaison', 'thomas'], newRole: 'liaison' },
   // After:
   'approval->approved': { allowedActors: ['liaison', 'thomas'], newRole: 'qa' },
   ```

2. **`src/db/__tests__/workflow-engine.test.ts` line ~219:**
   ```javascript
   // Before:
   expect(newRole).toBe("liaison");
   // After:
   expect(newRole).toBe("qa");
   ```

Also update the comment on line 50 from "AC5: approval enforces role=liaison" to "AC5: approval→approved routes to qa for testing".

---

## STUDY

Root cause: The original AC5 was written before WORKFLOW.md v12 clarified that `approved` is owned by QA. The engine comment and test both locked in the wrong role.

---

## ACT

Design ready for DEV. Run `npm test -- src/db/__tests__/workflow-engine.test.ts` after fix.
