# PDSA: Recover Lost Viz Features — PDSA Links, Changelog Refs

**Task:** ms-viz-recover-lost-features
**Version:** v0.0.1
**Status:** PLAN

## Problem

LITE_FIELDS in viz/server.js line 38 strips DNA to 8 fields. The detail panel (index.html line 1835+) renders `pdsa_ref`, `abstract_ref`, `changelog_ref` but these are not in LITE_FIELDS, so the data never arrives. Users see empty sections where links should appear.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add `pdsa_ref`, `abstract_ref`, `changelog_ref` to LITE_FIELDS array | Quick fix — 3 string fields, minimal payload increase (~200 bytes per task with refs) |
| D2 | Do NOT add review/test fields (qa_review, pdsa_review, etc.) | Audit confirms detail panel does not render these — no data loss |
| D3 | Option 2 (full DNA on detail open) deferred to ms-api-viz-endpoints Phase 1.5 | Proper fix comes with API migration; this is the interim quick fix |

### Acceptance Criteria

- AC1: LITE_FIELDS includes `pdsa_ref`, `abstract_ref`, `changelog_ref`
- AC2: Detail panel shows clickable PDSA links for tasks that have them
- AC3: Detail panel shows abstract_ref and changelog_ref when present
- AC4: Tasks without these fields still render correctly (no errors)
- AC5: Payload size increase is negligible (<500 bytes per task)

### Files to Change

- `viz/server.js` line 38 — Add 3 fields to LITE_FIELDS array

### Test Plan

1. Open Viz, click a task with pdsa_ref → link visible and clickable
2. Click a task without pdsa_ref → no error, section hidden
3. Verify /api/data response includes the 3 new fields in lite DNA

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
