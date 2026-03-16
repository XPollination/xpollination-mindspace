# PDSA: LIAISON Q&A Structured History — Viz Display + LITE_FIELDS

**Task:** ms-liaison-qa-history
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 Phase 1.9 iteration

## Problem

Challenge question gate is active on CLI (develop→main merged). But Q&A fields are not visible in Viz — not in LITE_FIELDS, not rendered in Object Details panel. Thomas can't see what LIAISON reviewed.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add 6 Q&A fields to LITE_FIELDS array in viz/server.js | Fields must arrive at browser for display |
| D2 | Add liaison_review to LITE_FIELDS | Existing structured review also needs display |
| D3 | Render Q&A prominently in Object Detail panel | Thomas reads LIAISON's reasoning per question |
| D4 | No backfill — past tasks keep free-text liaison_review.challenges | Completed tasks are immutable |
| D5 | Use version-bump.sh for viz version | Mandatory per gate |

### LITE_FIELDS to Add

```
liaison_review, liaison_q1_approval, liaison_q2_approval, liaison_q3_approval,
liaison_q1_complete, liaison_q2_complete, liaison_q3_complete
```

### Acceptance Criteria

- AC1: LITE_FIELDS includes all 7 liaison fields (review + 6 Q&A)
- AC2: Object Detail panel renders Q&A questions and answers
- AC3: Q&A section visible only when fields are present (no empty sections)
- AC4: liaison_review object displayed as structured whitebox
- AC5: New viz version via version-bump.sh

### Files to Change

- `viz/server.js` — Add 7 fields to LITE_FIELDS
- `viz/versions/v0.0.X/index.html` — Render Q&A in detail panel

### Test Plan

1. Open task with Q&A fields → see questions and answers in detail panel
2. Open task without Q&A → no empty Q&A section
3. Verify LITE_FIELDS includes all 7 fields

## Do / Study / Act

(To be completed)
