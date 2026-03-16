# PDSA: Monitor Skill — A2A Connect at Wake-Up

**Task:** ms-monitor-a2a-connect
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.20 Phase 7.3

## Problem

Monitor skill wakes agents via Brain recovery but doesn't register with Mindspace A2A server. Agents are invisible in Viz and have no heartbeat tracking.

## Plan

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add POST /a2a/connect call in SKILL.md Step 3 (after recovery, before monitor start) | Agent registers with Mindspace on wake-up |
| D2 | Payload: agent digital twin (agent_id, role, project, session_id, state) | A2A server needs identity to track agent |
| D3 | Parse WELCOME response for session_id and endpoints (stream, heartbeat) | Agent knows its A2A session |
| D4 | Graceful degradation: if A2A server down, continue without registration | Brain recovery is primary, A2A is supplementary |
| D5 | Store A2A session_id for heartbeat use in task workflow | Enables periodic heartbeat during work |

### Acceptance Criteria

- AC1: SKILL.md Step 3 includes POST /a2a/connect curl call
- AC2: Payload includes agent_id, role, project, session_id
- AC3: WELCOME response parsed for session_id
- AC4: A2A server down → agent continues working (no crash)
- AC5: Agent appears in Viz agent bar after connect

### Files to Change

- `~/.claude/skills/xpo.claude.monitor/SKILL.md` — Add A2A connect in Step 3

### Test Plan

1. Run /xpo.claude.monitor → verify A2A connect call made
2. Check Viz agent bar → agent visible
3. Stop A2A server → run monitor → verify graceful degradation

## Do / Study / Act

(To be completed)
