# PDSA: A2A Server — 8 Endpoints + SSE

**Task:** a2a-server-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-A2A-005

## Problem

Current A2A endpoints are scattered across multiple route files. Need unified LLM-less A2A server with 8 standard endpoints.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Routes in existing API server (not separate process) | Shared auth, DB, middleware. One less process to manage on CX22. |
| D2 | SSE keepalive every 30s | Prevents proxy/LB timeout (typically 60s). Detects dead clients. |
| D3 | Lease-based disconnection: 5min timeout, 3 missed heartbeats | Agent must heartbeat every 90s. After 5min silence, mark disconnected, expire lease. |

### 8 Endpoints

1. `POST /a2a/checkin` — Agent registers with digital twin. Returns session + endpoints.
2. `POST /a2a/claim` — Claim a task. Creates lease bond. Returns task DNA.
3. `POST /a2a/submit` — Submit work (findings, implementation). Updates DNA.
4. `POST /a2a/review` — Submit review (qa_review, pdsa_review). Transition forward.
5. `POST /a2a/create` — Create new object via twin protocol. Validates twin.
6. `POST /a2a/evolve` — Request object evolution (version bump + diff).
7. `GET /a2a/events/:agent_id` — SSE stream. Push: TASK_AVAILABLE, REVIEW_NEEDED, HEARTBEAT_ACK.
8. `GET /a2a/health` — A2A subsystem health. SpiceDB connection, active agents, lease stats.

### SSE Event Types

| Event | Payload | Trigger |
|-------|---------|---------|
| TASK_AVAILABLE | `{slug, title, role}` | New task matches agent role |
| REVIEW_NEEDED | `{slug, title, from}` | Task enters review for agent's role |
| HEARTBEAT_ACK | `{timestamp}` | Response to agent heartbeat |
| LEASE_EXPIRING | `{slug, expires_in}` | 60s before lease expires |
| EVOLVE_READY | `{slug, new_version}` | Object evolution available |

### Lease Management

Agent claims task → 30min lease. Heartbeat extends lease. 3 missed heartbeats (4.5min) → lease expires → task released back to pool. Agent can reclaim.

### Acceptance Criteria

- AC1: All 8 endpoints mounted and responding
- AC2: SSE stream delivers events to connected agents
- AC3: Lease bonds created on claim, expired on timeout
- AC4: Twin validation on create/evolve
- AC5: Health endpoint reports SpiceDB + agent stats

### Test Plan

api/__tests__/a2a-server.test.ts
