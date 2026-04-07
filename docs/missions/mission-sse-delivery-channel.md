# SSE as Universal Delivery Channel — Agents and UI React to the Same Events

**Ref:** MISSION-SSE-DELIVERY-CHANNEL
**Version:** v1.0.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Active

<!-- @section: progression | v:1 | deps:[] -->
## Mission Progression

| # | Mission | Status | What it proved | What it left open |
|---|---------|--------|---------------|-------------------|
| 1 | Runner Architecture (/m/mission-runner-architecture) | Complete | 75/75 tests, twin kernel, P2P transport, conflict resolution | Headless runners, no interactive terminal |
| 2 | A2A Agent Work Delivery (/m/1A4Ld-YQ) | Active | Config-driven workflow engine, DELIVER handler, a2a-deliver.js, task announcer | **Agents have no SSE connection — task announcer can't deliver** |
| 3 | **This mission** | Active | — | — |

**What mission 2 baseline proved (2026-04-07):**

| Test | Result | Root Cause |
|------|--------|-----------|
| Full team spawns (4 agents, 8 sessions) | PASS | |
| LIAISON transitions pending→ready | PASS | |
| Task announcer delivers to PDSA | **FAIL** | `getConnectedAgents()===0` — no SSE connections |
| PDSA works + delivers via a2a-deliver.js | **FAIL** | Blocked by above |
| Full PDSA workflow (12 steps) | **FAIL** | Blocked by above |
| Team panel updates on own click | PASS | addAgent() renders locally |
| Team panel updates on external change | **FAIL** | No SSE event for team changes |

**Score: 3/8 PASS. Single root cause: nothing connects to SSE.**

---

<!-- @section: insight | v:1 | deps:[progression] -->
## Core Insight

The kanban UI and agents need the **same thing**: receive events via SSE and react.

```
SSE Event Bus
  ├── kanban-ui subscribes → re-renders (tasks, team)
  ├── pdsa-agent subscribes → claims work, delivers results
  ├── dev-agent subscribes → claims work, delivers results
  └── qa-agent subscribes → claims work, delivers results
```

The kanban UI already connects as a pseudo-agent. It already handles `transition`, `object_create`, `object_update` events. But it does NOT handle `agent_spawned`/`agent_terminated`. And agents in tmux have NO SSE connection at all.

**If the UI doesn't update, the agents didn't receive.** The UI IS the test instrument for agent delivery. Fixing one fixes both.

From the "Structure, Not Retrieval" reflection: the bottleneck is not retrieval, it's structure. The events are there. The handler is there. The SSE infrastructure is there. What's missing is the STRUCTURE that connects them — who subscribes, what events are broadcast, when delivery happens.

---

<!-- @section: architecture | v:1 | deps:[insight] -->
## Architecture

### What Exists (Working)

| Component | Where | Status |
|-----------|-------|--------|
| SSE manager | `api/lib/sse-manager.ts` | sendToAgent, sendToRole, broadcast, addConnection, removeConnection |
| A2A stream endpoint | `api/routes/a2a-stream.ts` | GET /a2a/stream/:agent_id — persistent SSE connection |
| Kanban SSE client | `viz/versions/v0.0.38/js/a2a-client.js` | Connects as pseudo-agent, handles transition/object events |
| Task announcer | `api/lib/task-announcer.ts` | Finds ready tasks, tries SSE then tmux delivery |
| DELIVER handler | `api/routes/a2a-message.ts` | Validates gates, writes DNA, routes events |
| Workflow engine | `api/lib/workflow-engine.ts` + `api/config/workflow.yaml` | Config-driven transitions and gates |
| Claude in tmux | `api/routes/team.ts` | +1 Dev spawns Claude Code, interactive terminal |

### What's Missing

| Gap | Impact | Fix |
|-----|--------|-----|
| **Agents don't connect to SSE** | Task announcer can't reach them via sendToRole | Agents need SSE connection on spawn |
| **No team change events** | UI doesn't update when agents spawn/terminate externally | team.ts must broadcast agent_spawned/agent_terminated |
| **kanban.js doesn't handle team events** | Team panel stale | Add client.on('agent_spawned/terminated') listener |
| **Task announcer only announces `ready` tasks** | approval/review/rework tasks don't reach agents | Expand announcer to all actionable states |
| **No delivery for non-ready states** | Full workflow blocked after PDSA→approval | Task announcer must handle approval→liaison, review→chain, etc. |

---

<!-- @section: implementation | v:1 | deps:[architecture] -->
## Implementation Plan

### Step 1: Broadcast team change events

**File:** `api/routes/team.ts`

On agent spawn: `broadcast('agent_spawned', { id, role, session })` 
On agent terminate: `broadcast('agent_terminated', { id, role })`

### Step 2: Kanban listens for team events

**File:** `viz/versions/v0.0.38/js/kanban.js`

```javascript
client.on('agent_spawned', () => loadTeam());
client.on('agent_terminated', () => loadTeam());
```

### Step 3: Agents connect to SSE on spawn

**File:** `api/routes/team.ts`

When spawning an agent, ALSO register it with A2A and open an SSE listener. Two options:

**Option A: monitor-v2.js sidecar (deprecated — reintroduces polling)**
**Option B: Lightweight SSE bridge** — a minimal process that connects to `/a2a/stream/{agent_id}`, receives events, and delivers to Claude via tmux send-keys. No polling. Pure event-driven. Like monitor-v2.js but WITHOUT the auto-claim logic — just delivery.

### Step 4: Task announcer handles all actionable states

**File:** `api/lib/task-announcer.ts`

Expand from `WHERE status = 'ready'` to `WHERE status IN ('ready', 'approval', 'review', 'rework', 'approved')`. Each status routes to the correct role using workflow.yaml config.

### Step 5: Agent SSE bridge delivers structured instructions

When the bridge receives a `task_available`, `approval_needed`, `review_needed`, or `rework_needed` event, it:
1. Builds instruction text from workflow.yaml
2. Includes the a2a-deliver.js command
3. Delivers via tmux send-keys to Claude session

---

<!-- @section: tests | v:1 | deps:[implementation] -->
## Test Cases (from baseline — these define DONE)

### TC-1: Full PDSA Workflow (no simulation)

```
Precondition: Full team running. Task pending+pdsa. All agents authenticated.

STEP 1: LIAISON transitions pending→ready                   BASELINE: PASS
STEP 2: Task announcer delivers to PDSA                     BASELINE: FAIL
STEP 3: PDSA works + delivers via a2a-deliver.js            BASELINE: FAIL
STEP 4: LIAISON agent receives approval + approves           BASELINE: FAIL
STEP 5: QA agent receives + writes tests                     BASELINE: FAIL
STEP 6: DEV agent implements + delivers to review            BASELINE: FAIL
STEP 7: Review chain qa→pdsa→liaison→complete                BASELINE: FAIL

Target: 7/7 PASS
```

### TC-UI-1: Team panel updates on own click

```
GIVEN: Kanban open, "No agents"
WHEN: Click +1 Dev
THEN: Runner card appears immediately

BASELINE: PASS
```

### TC-UI-2: Team panel updates on external change

```
GIVEN: Kanban open, 1 agent showing
WHEN: Agent terminated via API (not from this browser)
THEN: Runner card disappears WITHOUT page refresh

BASELINE: FAIL
```

### TC-UI-3: Team panel shows agent spawned by another user

```
GIVEN: Kanban open on Thomas's browser
WHEN: Robin spawns +1 Dev from his machine
THEN: Thomas sees the new agent appear WITHOUT refresh

BASELINE: NOT TESTED (requires multi-user)
```

### TC-AUTH: OAuth token expiry handling

```
GIVEN: Agent running for >24h
WHEN: Max plan OAuth token expires
THEN: Agent detects 401, notifies server, server announces AGENT_AUTH_EXPIRED

BASELINE: FAIL (agent just dies silently with 401)
```

---

<!-- @section: decisions | v:1 | deps:[implementation,tests] -->
## Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | SSE is THE delivery channel for both UI and agents | Same mechanism, same events. UI shows what agents receive. |
| D2 | Lightweight SSE bridge, not monitor-v2.js | Bridge is event-driven (no polling). monitor-v2.js auto-claimed (wrong — server should coordinate). |
| D3 | Team change events via broadcast | Same pattern as transition events. Kanban already handles SSE. |
| D4 | Task announcer expands to all actionable states | Ready is not the only state that needs agent action. Approval, review, rework all need delivery. |
| D5 | Baseline fails ARE the specification | TDD at architecture level. Don't fix reactively. Define what should pass, build until it does. |
