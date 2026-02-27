# PDSA: Status Field Standardization

**Date:** 2026-02-04
**Node:** req-status-standardization (fae71907-8bad-41cb-936d-088bc25a3be2)
**Type:** Requirement
**Status:** REVIEW (awaiting Thomas)
**Bug:** bug-status-inconsistency (81766876-7fbd-4441-ac3c-a752f6fd15c5)

## PLAN

### Problem Statement

Status field inconsistency causes nodes to disappear from visualization.

**Observed behavior (2026-02-04):**
- Orchestrator agent set status to `completed` (with 'd')
- PDSA agent set status to `complete` (without 'd')
- Dev agent set status to `completed` (with 'd')
- Result: PDSA ping task vanished from visualization

### Root Cause Analysis

| Source | Value Used | Expected |
|--------|-----------|----------|
| Schema comment (line 128) | `complete` | - |
| mcp-server DB actual | `completed` | - |
| HomePage DB actual | `complete` | - |
| viz/index.html (line 967) | `completed` or `done` | `completed` |
| viz/server.js (line 108) | `completed` or `done` | `completed` |

**Root causes:**
1. Schema defines `status TEXT` with no CHECK constraint
2. Schema comment says `complete`, but visualization code expects `completed`
3. No validation layer between agents and database
4. Agents learned different conventions from different contexts

### Proposed Solution (UPDATED)

**Option A: Application Validation (RECOMMENDED)**
- Add validation in `pm_transition` MCP tool
- Reject invalid status values before DB write
- Easier to deploy than schema changes

```javascript
const VALID_STATUSES = ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
if (!VALID_STATUSES.includes(newStatus)) {
  throw new Error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}`);
}
```

**Option B: Database CHECK Constraint**
```sql
ALTER TABLE mindspace_nodes ADD CONSTRAINT check_status
CHECK (status IN ('pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'));
```

**Option C: Update Visualization**
- Update viz to recognize `complete` (current code expects `completed`)
- Files: viz/index.html:967, viz/server.js:108, viz/export-data.js:59

**Recommendation:** Option A (application validation) + Option C (viz fix). Immediate protection + viz compatibility.

### Canonical Status Values (CORRECTED)

**Use `complete` (no 'd')** - matches schema comment.

| Status | Meaning |
|--------|---------|
| `pending` | Not started, waiting |
| `ready` | Ready for work, can be claimed |
| `active` | Currently being worked on |
| `review` | Awaiting human review |
| `rework` | Needs changes after review |
| `complete` | Successfully finished (NO 'd') |
| `blocked` | Cannot proceed, dependency issue |
| `cancelled` | Intentionally stopped |

**PDSA Lesson:** I (PDSA agent) used `completed` while fixing this very bug. Irony noted.

---

## Acceptance Criteria

- [ ] AC1: Define canonical status values (use `completed` with 'd')
- [ ] AC2: Add CHECK constraint to schema OR validation in code
- [ ] AC3: Update viz to handle both values during migration
- [ ] AC4: Migrate existing data to canonical values
- [ ] AC5: Document status values in CLAUDE.md

---

## Questions for Thomas

1. **Canonical value:** Use `completed` (matches viz) or `complete` (matches schema comment)?
2. **Enforcement:** Database constraint vs code validation vs both?
3. **Migration:** Run migration on both DBs (mcp-server + HomePage)?

---

## DO

(Awaiting Thomas review)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-status-field-standardization.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-status-field-standardization.pdsa.md
