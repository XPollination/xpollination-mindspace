# PDSA: Link Tasks to Requirements via requirement_refs

**Task:** ms-task-requirement-linking | **Version:** v0.0.1 | **Status:** PLAN
**Roadmap:** ROAD-002 Phase 2

## Problem
400+ tasks have no requirement_refs. No traceability from task to requirement to capability to mission.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add requirement_refs to task DNA (array of REQ slugs) | Traceability field |
| D2 | Auto-link ROAD-001 tasks by group: AUTH→REQ-AUTH-*, WORKFLOW→REQ-WF-* | Bulk assignment |
| D3 | Tasks with no clear mapping: leave empty | Link later when context available |
| D4 | Viz detail panel shows requirement links | Visibility |
| D5 | Viz hierarchy: Requirement→Tasks drill-down | Traversable graph |

### Acceptance Criteria
- AC1: requirement_refs field in task DNA schema
- AC2: ROAD-001 tasks auto-linked to requirements by group
- AC3: Viz shows requirement links in task detail
- AC4: Clicking requirement shows implementing tasks
- AC5: Empty requirement_refs handled gracefully (no errors)

### Files: Migration/script for bulk linking, Viz detail panel rendering
