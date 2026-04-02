# Agents Subscribe to Events — Event-Driven Team Collaboration via A2A

**Ref:** MISSION-AGENT-A2A-EVENTS
**Version:** v2.0.0
**Date:** 2026-04-02
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — architecture defined, implementation next

**Builds on:** Runner Architecture (/m/mission-runner-architecture) — Interactive terminal working

---

## Management Abstract

Agents spawned via "+1 Dev" in the kanban can see each other, but cannot hear each other. The A2A server — the nervous system — already carries signals. The missing piece: spawned agents don't listen. This mission adds event subscriptions so agents react to workflow events independently — no agent talks TO another. Each agent publishes what happened, and all interested agents react. Workflow gates enforce the PDSA process at every transition. The event bus validates, the agents execute.

**The analogy:** A package scanned at the distribution center doesn't "tell" the routing system what to do. It publishes an event. The tracking app updates. The route gets optimized. The customer gets notified. All independently. Same for agents: DEV publishes "implementation completed" → QA reacts (starts review) → Brain reacts (learns) → Kanban reacts (moves card).

---

## Why This Mission Exists

Thomas spawned a DEV agent and a PDSA agent on beta. The DEV agent discovered the A2A server and tried to send a message to PDSA. The message was delivered to the A2A server — but PDSA wasn't listening. The message was lost.

The initial framing was "agent-to-agent chat." Thomas corrected: **this is event streaming, not chat.** The architecture insight:

| Pattern | Description | Problem |
|---------|-------------|---------|
| **Chat (point-to-point)** | DEV sends message TO PDSA | Tightly coupled. DEV must know PDSA exists. Breaks if PDSA is offline. |
| **Event streaming** | DEV publishes "implementation done" — all interested agents react | Decoupled. Works with 1 agent or 10. Agents are interchangeable. |

---

## Part 1: Architecture — Events, Not Messages

### The Paradigm Shift

```
OLD (imperative, tightly coupled):
  LIAISON tells DEV: "do this task"
  DEV tells QA: "review this"
  QA tells LIAISON: "approve this"
  → Each agent knows the next agent. Breaks if agent is missing.

NEW (event-driven, decoupled):
  LIAISON publishes: TASK_CREATED {role: dev, status: ready}
  DEV reacts: claims task → publishes: TASK_TRANSITIONED {active → review}
  QA reacts: reviews → publishes: TASK_TRANSITIONED {review → approval}
  LIAISON reacts: presents to Thomas
  → No agent knows any other agent. Works with any number of runners.
```

![Event-Driven Workflow](docs/missions/diagrams/agent-a2a-chat/event-driven-workflow.svg)

### Gates Live in the Event Handler

The workflow gates are **not** in the agents. They're in the A2A event handler. When any agent publishes a transition event:

1. **State machine check:** Is `active → review` a valid transition?
2. **Role check:** Does the actor match the task's current role?
3. **DNA quality check:** Are required fields set (pdsa_ref, implementation, etc.)?
4. **Brain gate:** Did the agent contribute learnings before transitioning?
5. **Human gate:** Did Thomas approve (for approval → approved)?

If ANY gate fails → transition rejected → event NOT published → agent gets error response.

This means: an agent CAN'T skip steps even if it wanted to. The gates are structural, enforced by the event bus, not by trust in agents.

### Multiple Subscribers React Independently

Every event has multiple subscribers:

| Subscriber | Reacts to | Action |
|------------|-----------|--------|
| **Next-role agent** | TASK_ASSIGNED for own role | Claims task, starts work |
| **Kanban UI** | ALL transitions | Moves card, updates status display |
| **Brain** | ALL events | Learns patterns, detects anomalies, reflects |
| **Cascade engine** | COMPLETE events | Unblocks dependent tasks, triggers pipeline |
| **Thomas (via LIAISON)** | APPROVAL_NEEDED | Reviews, decides, approves or rejects |

No subscriber knows about any other. They all react to the same event independently.

![Task Lifecycle as Events](docs/missions/diagrams/agent-a2a-chat/event-lifecycle.svg)

---

## Part 2: The Nervous System (A2A)

The A2A server is NOT a workflow orchestrator — it is the **service mesh** (brain decision 2026-03-18). It routes events to the right subscribers based on their role and project.

### Why A2A, Not MCP

MCP is for **tool access** — brain queries, file operations, structured data. A2A is for **agent signals** — events, transitions, announcements. They serve different purposes:

| Layer | Protocol | Purpose |
|-------|----------|---------|
| Cognitive | Brain API | Knowledge, reflection, learning |
| Nervous System | **A2A** | Events between agents, fast, ephemeral, reactive |
| Tool Access | MCP | Brain queries, file ops, structured tools |
| Execution | Runner/tmux | Claude Code, inference |

Wrapping A2A as MCP would lose: SSE push (MCP is pull), cross-hub federation, protocol standardization, and the architectural separation between signals and tools.

### What Exists (Working)

| Component | Status | How |
|-----------|--------|-----|
| A2A server | Working | Express + SSE, message routing by type |
| Event types | Working | TASK_ASSIGNED, REVIEW_NEEDED, APPROVAL_NEEDED, REWORK_NEEDED |
| SSE push to role | Working | `sendToRole('dev', event, data)` |
| Workflow gates | Working | State machine, role check, DNA quality, brain gate, human gate |
| monitor-v2.js | Exists | SSE listener at `/app/src/a2a/monitor-v2.js` |

### What's Missing

| Component | Status | Gap |
|-----------|--------|-----|
| Agent SSE listener | Missing | Agents don't open SSE stream on spawn |
| Auto-connect on spawn | Missing | No `/a2a/connect` call during `+1 Dev` |
| Event injection | Missing | Monitor receives events but can't feed them to Claude |
| Agent identity in prompt | Missing | Claude doesn't know its agent_id or how to publish events |

---

## Part 3: Spawn Flow

### Current (broken)

```
+1 Dev → tmux session with Claude → agent is DEAF
         (no A2A connection, no SSE listener, no identity)
```

### Target

```
+1 Dev → POST /a2a/connect → agent_id + session_token
       → tmux session with Claude (foreground)
         → system prompt includes: agent_id, token, event examples
       → monitor-v2.js {agent_id} (background sidecar)
         → GET /a2a/stream/{agent_id} — SSE connection
         → On event: injects into Claude session
       → Agent PUBLISHES events and REACTS to events
```

![Spawn and Listen Flow](docs/missions/diagrams/agent-a2a-chat/spawn-and-listen.svg)

---

## Part 4: Implementation

### Step 1: Register agent with A2A on spawn

In `api/routes/team.ts spawnAgent()`, before creating the tmux session:

1. `POST /a2a/connect` with agent identity (role, project, name)
2. Receive `agent_id` and `session_token`
3. Store `agent_id` in the agents DB record
4. Include `agent_id` and event examples in Claude's system prompt

### Step 2: Start monitor-v2.js sidecar

After creating the Claude tmux session:

```bash
node /app/src/a2a/monitor-v2.js --role dev --agent-id {agent_id} --session runner-dev-{id} &
```

The monitor:
- Connects to `GET /a2a/stream/{agent_id}`
- Receives SSE events routed by role
- On TASK_ASSIGNED: injects task info into Claude session
- On REVIEW_NEEDED: injects review request
- On REWORK_NEEDED: injects rework instructions

### Step 3: Event injection into Claude

When monitor receives an event:
- Write to `/tmp/a2a-inbox-{role}.json` (Claude can read this file)
- AND/OR `tmux send-keys` to inject as a user message
- Claude reacts: reads event, performs work, publishes transition

### Step 4: Agent publishes events via curl

Claude's system prompt includes event publishing examples:

```bash
# Transition task (after completing work):
curl -X POST http://localhost:3101/a2a/message \
  -H "Authorization: Bearer {session_token}" \
  -H "Content-Type: application/json" \
  -d '{"type":"TRANSITION","agent_id":"{agent_id}","task_slug":"my-task","to_status":"review"}'
```

The A2A server validates the transition through all gates, then publishes the event to all subscribers.

---

## Part 5: Acceptance Criteria

```
AC-1: Agent registered with A2A on spawn
  GIVEN: User clicks +1 Dev
  WHEN:  Agent spawns
  THEN:  POST /a2a/connect was called
  AND:   Agent has agent_id stored in DB
  AND:   monitor-v2.js sidecar is running

AC-2: Agent receives events
  GIVEN: DEV agent spawned with monitor sidecar
  WHEN:  A task transitions to ready+dev
  THEN:  DEV agent receives TASK_ASSIGNED event
  AND:   Event is visible in Claude's context

AC-3: Agent publishes transitions
  GIVEN: DEV agent completed work on a task
  WHEN:  Agent sends TRANSITION message via A2A
  THEN:  Workflow gate validates the transition
  AND:   Event published to QA subscriber (review)
  AND:   Kanban UI updates (card moves)

AC-4: Full PDSA cycle via events
  GIVEN: PDSA and DEV agents both spawned
  WHEN:  Task created with role=pdsa
  THEN:  PDSA receives TASK_ASSIGNED → designs → publishes to approval
  AND:   LIAISON approves → event to DEV
  AND:   DEV receives → implements → publishes to review
  AND:   QA reviews → publishes → LIAISON completes
  AND:   All transitions validated by workflow gates

AC-5: Agent interchangeability
  GIVEN: Two DEV runners are connected
  WHEN:  A task transitions to ready+dev
  THEN:  Either runner can claim it
  AND:   The other runner ignores it (conflict resolution)
  AND:   If the claiming runner crashes, the task becomes claimable again
```

---

## Part 6: Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Events, NOT chat | Decoupled. No agent knows another. Agents publish what happened, subscribers react. Like a package scan triggering independent systems. |
| D2 | Gates in the event handler | Workflow gates validated at EVERY transition by the A2A server. Not by agent trust. Structural enforcement. |
| D3 | A2A for events, NOT MCP | A2A is the nervous system — signals, not tools. MCP is for brain/file access. Cross-hub federation requires protocol standardization. |
| D4 | monitor-v2.js as sidecar | Separation of concerns. Monitor handles SSE. Claude handles thinking. Sidecar can restart independently. |
| D5 | Per-agent monitor | Each agent has its own SSE connection. Clean lifecycle — terminate agent kills its monitor. |
| D6 | Multiple subscribers per event | Kanban, Brain, next-role agent, cascade engine — all react independently to the same event. |

---

## Part 7: Future (Not This Mission)

| Feature | Description |
|---------|-------------|
| Cross-hub federation | Agent on Hetzner publishes event → agent on Robin's MacBook subscribes via federated A2A |
| Event persistence | Events stored for offline agents — replay on reconnect |
| Agent discovery | Query who's subscribed, what roles are covered, capacity |
| Event history | Audit trail: every event, every gate check, every subscriber reaction |
| Broadcast events | Agent publishes to ALL agents (not role-filtered) for system announcements |

---

## Part 8: End-to-End Test Plan

### Phase 1: Ping-Pong — Minimum Viable Event Loop

**Goal:** Verify agents can subscribe to SSE events and react. No workflow, no tasks. Just: agent A publishes event → agent B sees it → agent B responds → agent A sees response.

**Preconditions:**
```
1. Terminate ALL existing agents on beta
   → GET /api/team/all → for each agent: DELETE /api/team/all/agent/{id}
   → Verify: GET /api/team/all returns {"agents":[],"capacity":{"max":4,"current":0}}
   → Kill all tmux: docker exec mindspace-test tmux kill-server

2. Verify beta is healthy
   → GET /health returns {"status":"ok"}
   → No tmux sessions running: docker exec mindspace-test tmux ls → "no server running"
```

**Test Steps:**

```
STEP 1: Spawn DEV agent with A2A registration
  ACTION: POST /api/team/all/agent {"role":"dev"}
  VERIFY:
    - Response has session field (tmux session name)
    - docker exec mindspace-test tmux ls → shows runner-dev-{id}
    - Agent registered in A2A: GET /api/agents/pool → contains dev agent
    - monitor-v2.js sidecar running: docker exec mindspace-test tmux ls → shows unblock-runner-dev-{id}
  EXPECTED: DEV agent alive in tmux + registered in A2A + SSE stream open

STEP 2: Spawn PDSA agent with A2A registration
  ACTION: POST /api/team/all/agent {"role":"pdsa"}
  VERIFY:
    - Same checks as Step 1 for pdsa
    - Two agents visible in GET /api/agents/pool
    - Two tmux sessions: runner-dev-{id}, runner-pdsa-{id}
  EXPECTED: Both agents alive + registered + listening

STEP 3: Verify SSE connectivity
  ACTION: Check A2A server SSE connections
  VERIFY:
    - GET /health → sse_connections >= 2 (both agents connected)
    - Each agent's monitor is connected to /a2a/stream/{agent_id}
  EXPECTED: Both agents subscribed to event stream

STEP 4: DEV sends HUMAN_INPUT event to PDSA
  ACTION: From DEV terminal (via tmux send-keys or browser terminal):
    curl -X POST http://localhost:3101/a2a/message \
      -H "Authorization: Bearer {dev_session_token}" \
      -H "Content-Type: application/json" \
      -d '{"type":"HUMAN_INPUT","agent_id":"{dev_agent_id}","text":"PING from DEV"}'
  VERIFY:
    - A2A server receives message (check logs)
    - SSE event pushed to PDSA's stream
    - PDSA's monitor-v2.js logs: "[PDSA] Received: PING from DEV"
    - OR: PDSA's tmux pane shows injected message
  EXPECTED: PDSA sees the event

STEP 5: PDSA responds with HUMAN_INPUT event to DEV
  ACTION: From PDSA terminal:
    curl -X POST http://localhost:3101/a2a/message \
      -H "Authorization: Bearer {pdsa_session_token}" \
      -H "Content-Type: application/json" \
      -d '{"type":"HUMAN_INPUT","agent_id":"{pdsa_agent_id}","text":"PONG from PDSA"}'
  VERIFY:
    - DEV's monitor-v2.js receives event
    - DEV's tmux pane shows "PONG from PDSA"
  EXPECTED: Bidirectional event flow confirmed

STEP 6: Screenshot verification
  ACTION: Take Chrome CDP screenshots of:
    - Kanban showing both agents in team panel
    - DEV terminal showing PONG received
    - PDSA terminal showing PING received
    - A2A server logs showing event routing
  EXPECTED: Visual proof of event-driven communication
```

**Success Criteria Phase 1:**
- Two agents spawn with A2A registration ✓
- SSE streams open for both agents ✓
- HUMAN_INPUT event from DEV reaches PDSA via SSE ✓
- HUMAN_INPUT event from PDSA reaches DEV via SSE ✓
- No direct tmux-to-tmux communication — ALL through A2A ✓

**What we learn:**
- Does monitor-v2.js connect reliably from inside the container?
- Does the SSE stream survive long enough for events?
- Does event injection into Claude sessions work?
- What latency from publish to receive?

---

### Phase 2: Full PDSA Workflow as Events

**Goal:** A task flows from creation to completion entirely via events. Agents react to events, gates enforce process, kanban updates in real-time.

**Preconditions:**
```
1. Phase 1 passed — agents can ping-pong via events
2. Terminate all agents from Phase 1
3. Beta has at least 1 task in ready+pdsa status
   → 16 ready+pdsa tasks exist on beta (verified: theia-docker-compose, etc.)
4. Spawn full team: PDSA + DEV agents (QA and LIAISON handled manually for now)
```

**Workflow under test (from WORKFLOW.md):**
```
ready+pdsa → active+pdsa → approval → approved → ready+dev → active+dev → review+qa → review+pdsa → review+liaison → complete
```

**Test Steps:**

```
STEP 1: Clean start
  ACTION:
    - Terminate all agents
    - Verify beta has ready+pdsa tasks
    - Spawn PDSA agent: POST /api/team/all/agent {"role":"pdsa"}
    - Spawn DEV agent: POST /api/team/all/agent {"role":"dev"}
  VERIFY:
    - Both agents registered in A2A
    - Both SSE streams open
    - Both monitors running
  EXPECTED: Team ready to receive events

STEP 2: PDSA receives TASK_ASSIGNED event
  ACTION: 
    - A ready+pdsa task exists (e.g., theia-docker-compose)
    - A2A server sends TASK_ASSIGNED to PDSA role via SSE
    - (May need manual trigger: transition task to ready to re-fire event)
  VERIFY:
    - PDSA monitor logs: "[PDSA] Task assigned: theia-docker-compose"
    - PDSA agent claims task (transitions ready → active)
    - Gate validates: role=pdsa ✓, memory_query_session set ✓
  EXPECTED: PDSA agent working on task

STEP 3: PDSA submits design → APPROVAL_NEEDED event
  ACTION:
    - PDSA agent completes work (designs)
    - PDSA transitions: active → approval
    - Gate validates: pdsa_ref set ✓, brain_contribution_id set ✓
  VERIFY:
    - A2A publishes APPROVAL_NEEDED event
    - LIAISON (Thomas via kanban) sees approval request
    - Kanban card moves to APPROVAL column
  EXPECTED: Design submitted, human gate activated

STEP 4: LIAISON approves → TASK_ASSIGNED(dev) event
  ACTION:
    - Thomas approves in kanban (or LIAISON transitions approval → approved)
    - Gate validates: human_answer set ✓
    - Workflow routes to approved → ready+dev
  VERIFY:
    - A2A publishes TASK_ASSIGNED to dev role
    - DEV agent receives event via SSE
    - DEV monitor logs: "[DEV] Task assigned: theia-docker-compose"
  EXPECTED: Task flows from PDSA to DEV via events

STEP 5: DEV implements → REVIEW_NEEDED event
  ACTION:
    - DEV agent claims and implements
    - DEV transitions: active → review
    - Gate validates: implementation set ✓, tests pass ✓
  VERIFY:
    - A2A publishes REVIEW_NEEDED to qa role
    - Kanban card moves to REVIEW column
    - (QA agent would receive if spawned)
  EXPECTED: Implementation submitted, review chain starts

STEP 6: Review chain (manual for Phase 2)
  ACTION:
    - QA reviews → transitions review (sets role to pdsa)
    - PDSA reviews → transitions review (sets role to liaison)
    - LIAISON reviews → transitions to complete
    - Each transition validated by gates
  VERIFY:
    - Each transition fires events
    - Kanban updates at each step
    - Brain gate enforced at each transition
    - Cascade engine unblocks dependents on complete
  EXPECTED: Task completed through full PDSA workflow

STEP 7: Full verification
  ACTION: Take Chrome CDP screenshots of:
    - Kanban showing task in COMPLETE column
    - Task detail showing all DNA fields filled
    - Agent terminal showing event history
    - A2A server logs showing full event chain
  VERIFY:
    - All workflow gates were enforced
    - All transitions happened via events (not direct calls)
    - Brain contributions at each transition
    - Task DNA complete: findings, design, implementation, reviews
  EXPECTED: Full PDSA cycle proven via event-driven architecture
```

**Success Criteria Phase 2:**
- Task assigned to PDSA via TASK_ASSIGNED event ✓
- PDSA submits design → APPROVAL_NEEDED event fires ✓
- Human approves → TASK_ASSIGNED(dev) event fires ✓
- DEV implements → REVIEW_NEEDED event fires ✓
- Review chain completes → COMPLETE event fires ✓
- Cascade engine unblocks dependent tasks ✓
- ALL transitions validated by workflow gates ✓
- Kanban UI updates in real-time via SSE ✓
- Brain contributions at each transition ✓

**What we learn:**
- Does the full workflow work end-to-end via events?
- Do gates catch invalid transitions from agents?
- Does the cascade engine trigger correctly?
- What's the total cycle time for one task?
- Where are the bottlenecks?
