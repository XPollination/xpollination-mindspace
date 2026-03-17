# PDSA: Port Full Workflow Engine into Express API

**Task:** ms-workflow-engine-in-api | **Version:** v0.0.1 | **Status:** PLAN
**Roadmap:** ROAD-001 POST.2

## Problem
API task-state-machine.ts is simplified — no actor checking, no DNA gates, no challenge questions. Full engine is in workflow-engine.js (CLI). Need authoritative workflow engine in API.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Replace task-state-machine.ts TRANSITION_MAP with full ALLOWED_TRANSITIONS | Complete transition rules |
| D2 | Port validateTransition with actor checking + DNA requirements | Authorization + gates |
| D3 | Port all gates: liaison_review, challenge questions, version_bump_ref, test pass, changelog | Full enforcement |
| D4 | API transition endpoint becomes authoritative | Single source of truth for workflow |
| D5 | CLI transitions through API instead of direct DB | Consistent enforcement |

### Acceptance Criteria
- AC1: API transition endpoint enforces all gates from workflow-engine.js
- AC2: Actor checking (who can perform which transition)
- AC3: DNA requirements validated (pdsa_ref, liaison_review, etc.)
- AC4: CLI uses API for transitions (not direct DB)
- AC5: All existing workflow-engine tests pass against API

### Files: `api/routes/task-transitions.ts` or `src/workflow/`, `src/db/interface-cli.js`
