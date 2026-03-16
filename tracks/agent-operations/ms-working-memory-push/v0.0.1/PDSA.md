# PDSA: Working Memory Push in Task Workflow

**Task:** ms-working-memory-push
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.12 Phase 0.2

## Problem

Working memory endpoint (POST /api/v1/working-memory/{agentId}) is deployed but no agent pushes state. Recovery endpoint reads working_state but it's always null because nothing writes to it. Agents lose context on restart/compact.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Push working state after task claim (SKILL.md Step 4) | Agent knows what it's working on — record it |
| D2 | Push after human decision transitions (approval/review) | Context changes after decisions |
| D3 | Push after task complete (SKILL.md Step 7) with null state | Clear working state when done |
| D4 | Update precompact-save.sh to push to working memory | Compact recovery needs current state |
| D5 | Working state payload: task_slug, title, step, human_expectation, pending_items | Minimum viable state for recovery self-test |

### Working State Schema

```json
{
  "task_slug": "ms-example",
  "project": "xpollination-mcp-server",
  "title": "Example task title",
  "step": "implementing D3",
  "human_expectation": "Design review of auth flow",
  "pending_items": ["D4 not started", "tests needed"]
}
```

### Push Points in SKILL.md

| When | Payload | Purpose |
|------|---------|---------|
| After Step 4 (claim) | Full state with task details | Recovery knows what agent is doing |
| After approval/review transition | Updated step + decision context | Recovery knows current phase |
| After Step 7 (complete) | null | Clear state, agent is idle |
| On precompact | Current state snapshot | Survives context compaction |

### Acceptance Criteria

- AC1: SKILL.md includes curl to POST /api/v1/working-memory/{agentId} after task claim
- AC2: Working state pushed after approval/review transitions
- AC3: Working state cleared (null) after task completion
- AC4: precompact-save.sh pushes to working memory endpoint
- AC5: Recovery endpoint returns the pushed working_state (verified with GET /api/v1/recovery/{agentId})
- AC6: Payload includes task_slug, title, step, human_expectation

### Files to Change

- `~/.claude/skills/xpo.claude.monitor/SKILL.md` — Add push points
- `xpollination-best-practices/scripts/xpo.claude.compact-recover.sh` (or equivalent precompact script) — Add working memory push

### Test Plan

1. Claim a task → verify GET /api/v1/recovery returns working_state with task details
2. Complete task → verify working_state is null
3. Trigger compact → verify precompact pushes state
4. Recover → verify self-test shows correct task context

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
