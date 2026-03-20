# PDSA: /xpo.claude.a2a.{role} Bootstrap Skill

**Task:** claude-a2a-skill-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-A2A-007

## Problem

/xpo.claude.monitor uses polling + Brain queries for recovery. With A2A server in place, agents should bootstrap via A2A: discover endpoints, authenticate, receive tasks via SSE instead of polling.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | One skill with role parameter (not 4 separate skills) | Less duplication. `/xpo.claude.a2a liaison` vs 4 separate skill files. Same connection logic, different role. |
| D2 | Keep /xpo.claude.monitor as fallback | A2A may be down. Monitor still works with polling. Graceful degradation. |
| D3 | Shared connection module in xpollination-best-practices | Reusable across agents. Git-tracked. Auto-deployed by claude-session.sh. |

### Boot Sequence

```
/xpo.claude.a2a {role}

Step 1: Set Identity (same as monitor)
Step 2: Discover — GET hive.xpollination.earth/.well-known/agent.json
Step 3: Authenticate — POST /a2a/checkin with digital twin
Step 4: Subscribe — GET /a2a/events/{agent_id} (SSE)
Step 5: Recovery — Query brain for role + task state (same as monitor)
Step 6: Wait — SSE delivers TASK_AVAILABLE events (no polling)

On TASK_AVAILABLE:
  1. Parse task slug from event
  2. POST /a2a/claim to claim task
  3. Work the task (same as monitor Step 5)
  4. POST /a2a/submit with findings
  5. Wait for next SSE event

On disconnect:
  1. Retry SSE connection 3 times (5s, 15s, 30s)
  2. If all retries fail: fall back to /xpo.claude.monitor polling
  3. Log fallback to brain
```

### Skill File Structure

```
~/.claude/skills/xpo.claude.a2a/SKILL.md
```

Content mirrors /xpo.claude.monitor structure but replaces:
- Polling loop → SSE subscription
- stat file check → SSE event handler
- sleep 30 → SSE keepalive

### Connection Module

```javascript
// xpollination-best-practices/scripts/xpo.claude.a2a-connect.sh
# Discover → Authenticate → Subscribe
# Returns: agent_id, session_id, stream_url
# Used by SKILL.md Step 2-4
```

### Fallback Strategy

```
A2A available:  SSE events → instant task delivery
A2A degraded:   SSE reconnect 3x → polling fallback
A2A down:       /xpo.claude.monitor (unchanged behavior)
Brain down:     CLAUDE.md + PM system scan (unchanged)
```

### Acceptance Criteria

- AC1: /xpo.claude.a2a {role} boots agent with A2A connection
- AC2: SSE delivers TASK_AVAILABLE without polling
- AC3: Fallback to monitor on A2A failure
- AC4: claim/submit via A2A endpoints
- AC5: Graceful reconnection (3 retries)
- AC6: Brain recovery still works alongside A2A

### Test Plan

api/__tests__/claude-a2a-skill.test.ts
