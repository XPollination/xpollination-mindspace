# PDSA: Verify Viz Hierarchy Drill-Down

**Task:** ms-viz-hierarchy-drilldown | **Version:** v0.0.1 | **Status:** PLAN
**Roadmap:** ROAD-002 verification

## Problem
Hierarchy data populated but Viz drill-down not verified. Need E2E browser test of Mission→Capability→Requirement→Task chain.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Mission Dashboard shows 10 capabilities with task counts | Top-level view |
| D2 | Click capability → shows linked requirements | Drill-down level 1 |
| D3 | Click requirement → shows implementing tasks | Drill-down level 2 |
| D4 | Task detail shows requirement_refs | Bottom-level context |
| D5 | Breadcrumb: Task→Requirement→Capability→Mission | Navigation trail |

### Acceptance Criteria
- AC1: Mission Dashboard renders with capability cards
- AC2: Capability click shows requirements
- AC3: Requirement click shows tasks
- AC4: Task detail shows requirement_refs
- AC5: Breadcrumb navigation works
- AC6: Test via HTTPS browser (not curl)

### Files: Viz index.html hierarchy views, API mission/capability/requirement endpoints
