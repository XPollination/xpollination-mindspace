# PDSA: Wire Monitor Skill to Recovery Endpoint

**Task:** ms-recovery-endpoint-wiring
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.12 Phase 0.1

## Problem

The monitor skill (xpo.claude.monitor SKILL.md Step 2) runs 3 generic brain POST queries on startup. These queries return echo entries (the query text echoed back at score 0.70) rather than structured recovery data. The recovery endpoint `GET /api/v1/recovery/{agentId}` is deployed and returns pre-filtered, structured recovery data in a single call.

## Plan

Replace Step 2's three generic brain queries with a single call to the recovery endpoint.

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Replace 3 POST queries with single GET /api/v1/recovery/agent-{role} | One call, structured output, no echo entries |
| D2 | If working_state is non-null, present mandatory self-test | Recovery protocol requires agent to confirm understanding before proceeding |
| D3 | If working_state is null, use key_context for orientation | Agent is idle — show recent context, proceed to monitoring |
| D4 | If endpoint fails, fall back to current 3 generic queries | Graceful degradation preserves existing behavior |
| D5 | Update Reference section with recovery endpoint URL | Documentation completeness |

### Acceptance Criteria

- AC1: Step 2 primary path calls `GET /api/v1/recovery/agent-{role}` (single curl)
- AC2: If `working_state` is non-null, skill instructs agent to present self-test
- AC3: If `working_state` is null, skill instructs agent to use `key_context` for orientation
- AC4: If endpoint returns error/timeout, fallback to current 3 generic brain queries
- AC5: Session ID generation preserved (needed for brain contributions later)
- AC6: Reference section includes recovery endpoint URL
- AC7: Git source (best-practices) and deployed copy (`~/.claude/skills/`) both updated

### Files to Change

- `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` (git source)
- `~/.claude/skills/xpo.claude.monitor/SKILL.md` (deploy copy — symlink or manual copy)

### Test Plan

Manual verification:
1. Run `/xpo.claude.monitor pdsa` — confirm single recovery endpoint call replaces 3 queries
2. Verify self-test output when `working_state` exists
3. Kill brain API, run monitor — confirm fallback to generic queries
4. Verify session ID is still generated for later brain contributions

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
