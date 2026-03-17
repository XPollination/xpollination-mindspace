# PDSA: Auto-Link Tasks to Requirements at Creation

**Task:** ms-auto-context-on-create | **Version:** v0.0.1 | **Status:** PLAN
**Roadmap:** ROAD-002 Phase 3

## Problem
Tasks created without requirement context. No automatic hierarchy linking.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Task creation prompts for requirement_ref | Every task has context |
| D2 | Auto-suggest requirements by group field | Reduce manual effort |
| D3 | Viz shows full chain: Task→Requirement→Capability→Mission | Traversable graph |
| D4 | System enforces: no task without context | "Why does this task exist?" always answerable |

### Acceptance Criteria
- AC1: Task creation includes requirement_ref prompt/auto-suggest
- AC2: Group-based suggestion maps to correct requirements
- AC3: Full chain visible in Viz task detail
- AC4: Graceful handling when no matching requirement found

### Files: CLI task creation, API task creation, Viz detail panel
