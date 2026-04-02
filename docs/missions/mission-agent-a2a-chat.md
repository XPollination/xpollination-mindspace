# Agent-to-Agent Chat via A2A — Spawned Runners Talk Through the Nervous System

**Ref:** MISSION-AGENT-A2A-CHAT
**Version:** v1.0.0
**Date:** 2026-04-02
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — architecture defined, implementation next

**Builds on:** Runner Architecture (/m/mission-runner-architecture) — Interactive terminal working

---

## Management Abstract

Agents spawned via "+1 Dev" in the kanban can see each other, but cannot talk. The A2A server — the nervous system — already carries signals between agents. The missing piece: spawned agents don't listen. This mission adds an SSE listener sidecar to each spawned agent so they can receive messages, task assignments, and chat from other agents. Two agents on the same Mindspace can chat. Future: two agents on different Mindspace instances chat via federated A2A.

---

## Why This Mission Exists

The Runner Architecture mission delivered interactive agents in the browser. Thomas spawned a DEV agent and a PDSA agent. The DEV agent discovered the A2A server and tried to send a chat message to PDSA. The message was delivered to the A2A server — but PDSA wasn't listening. The message was lost.

| What works | What's missing |
|------------|----------------|
| +1 Dev spawns Claude in tmux with xterm.js terminal | Agent doesn't open SSE listener on spawn |
| A2A server accepts HUMAN_INPUT messages | No sidecar to receive SSE events |
| SSE manager pushes to connected agents | Spawned agents never connect to SSE stream |
| monitor-v2.js exists as SSE listener | Not started alongside Claude |

---

## Part 1: Architecture

### The Nervous System (A2A)

The A2A server is NOT a workflow orchestrator — it is the **service mesh** (brain decision 2026-03-18). It routes requests to the right agent, manages sessions, and carries signals. The protocol enables:

- **Same-hub chat:** DEV and PDSA on the same Mindspace talk via A2A
- **Cross-hub federation:** DEV on Hetzner and QA on Robin's MacBook talk via federated A2A (future)
- **Protocol as the product:** A2A is the standard, not a tool wrapper

### Why A2A, Not MCP

MCP is for **tool access** — brain queries, file operations, structured data. A2A is for **agent signals** — chat, task assignments, reviews, transitions. They serve different purposes:

| Layer | Protocol | Purpose |
|-------|----------|---------|
| Cognitive | Brain API | Knowledge, reflection, learning |
| Nervous System | **A2A** | Signals between agents, fast, ephemeral |
| Tool Access | MCP | Brain queries, file ops, structured tools |
| Execution | Runner/tmux | Claude Code, inference |

Wrapping A2A as MCP would lose: SSE push (MCP is pull), cross-hub federation, protocol standardization, and the architectural separation between signals and tools.

---

## Part 2: Spawn Flow (Current → Target)

### Current (broken)

```
+1 Dev → POST /a2a/connect (skipped) → tmux session with Claude → agent is DEAF
```

### Target

```
+1 Dev → POST /a2a/connect → agent_id + token
       → tmux session with Claude (foreground)
       → monitor-v2.js {agent_id} (background sidecar)
       → SSE stream open → agent LISTENS and SENDS
```

**Diagram:** [spawn-and-listen.svg](docs/missions/diagrams/agent-a2a-chat/spawn-and-listen.svg)

---

## Part 3: Chat Flow

```
DEV types: "tell PDSA to review my implementation"
  → Claude sends: curl POST /a2a/messages {type: HUMAN_INPUT, to: pdsa_agent_id, text: "..."}
    → A2A server receives → finds PDSA SSE connection → pushes event
      → PDSA monitor-v2.js receives event
        → Injects into PDSA Claude session via tmux send-keys
          → PDSA Claude reads message, acts, responds via POST /a2a/messages
            → DEV monitor receives response → injects into DEV Claude
```

**Diagram:** [chat-flow.svg](docs/missions/diagrams/agent-a2a-chat/chat-flow.svg)

---

## Part 4: Implementation

### Step 1: Register agent with A2A on spawn

In `api/routes/team.ts spawnAgent()`, before creating the tmux session:

1. `POST /a2a/connect` with agent identity (role, project, name)
2. Receive `agent_id` and `session_token`
3. Store `agent_id` in the agents DB record
4. Pass `agent_id` and `session_token` to Claude's system prompt

### Step 2: Start monitor-v2.js sidecar

After creating the Claude tmux session, start `monitor-v2.js` as a background process in a companion tmux window or separate session:

```bash
node /app/src/a2a/monitor-v2.js --role dev --agent-id {agent_id} --session runner-dev-{id} &
```

The monitor:
- Connects to `GET /a2a/stream/{agent_id}` 
- Receives SSE events
- On HUMAN_INPUT: `tmux send-keys -t runner-dev-{id} "Message from {sender}: {text}" Enter`
- On TASK_ASSIGNED: writes to `/tmp/a2a-inbox-{role}.json` for Claude to read

### Step 3: Inject agent_id into Claude's context

Claude needs to know:
- Its own `agent_id` (to authenticate messages)
- Its `session_token` (for API calls)
- How to discover other agents (`GET /api/agents/pool`)
- How to send messages (`POST /a2a/messages`)

Add to the `--append-system-prompt`:
```
Your A2A identity:
  agent_id: {agent_id}
  session_token: {session_token}

To send a message to another agent:
  curl -X POST http://localhost:3101/a2a/messages \
    -H "Authorization: Bearer {session_token}" \
    -H "Content-Type: application/json" \
    -d '{"type":"HUMAN_INPUT","agent_id":"{agent_id}","to":"{target_agent_id}","text":"your message"}'

To discover connected agents:
  curl http://localhost:3101/api/agents/pool -H "Authorization: Bearer {session_token}"
```

### Step 4: Test — two agents chat

1. Click +1 Dev → agent spawns with monitor sidecar
2. Click +1 PDSA → agent spawns with monitor sidecar
3. In DEV terminal: tell Claude to send message to PDSA
4. PDSA receives message via SSE → monitor injects into session
5. PDSA responds → DEV receives response
6. Verify via Chrome CDP screenshots

---

## Part 5: Acceptance Criteria

```
AC-1: Agent registered with A2A on spawn
  GIVEN: User clicks +1 Dev
  WHEN:  Agent spawns
  THEN:  Agent has agent_id in DB
  AND:   POST /a2a/connect was called
  AND:   monitor-v2.js is running as sidecar

AC-2: Agent receives SSE events
  GIVEN: DEV agent spawned with monitor sidecar
  WHEN:  A2A server sends TASK_ASSIGNED event
  THEN:  monitor-v2.js receives the event
  AND:   Event is injected into Claude session

AC-3: Agent-to-agent chat
  GIVEN: DEV and PDSA agents both spawned
  WHEN:  DEV sends HUMAN_INPUT to PDSA via A2A
  THEN:  PDSA receives the message in its Claude session
  AND:   PDSA can respond back to DEV

AC-4: Agent knows its identity
  GIVEN: Agent spawns
  THEN:  Claude's system prompt contains agent_id and session_token
  AND:   Claude can discover other agents via /api/agents/pool
  AND:   Claude can send messages via /a2a/messages
```

---

## Part 6: Future (Not This Mission)

| Feature | Description |
|---------|-------------|
| Cross-hub federation | Agent on Hetzner chats with agent on Robin's MacBook via federated A2A |
| Message persistence | Offline agents receive messages when they reconnect |
| Agent discovery | Agents query who else is connected, their roles, their capacity |
| Chat history | Messages stored and retrievable for context recovery |
| Broadcast | Agent sends message to ALL agents with a specific role |

---

## Part 7: Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | A2A for chat, NOT MCP | A2A is the nervous system — signals, not tools. MCP is for brain/file access. Cross-hub federation requires protocol standardization. |
| D2 | monitor-v2.js as sidecar, not built into Claude | Separation of concerns. Monitor handles SSE. Claude handles thinking. Sidecar can restart independently. |
| D3 | tmux send-keys for message injection | Simplest path. Claude sees messages as user input. No custom IPC needed. |
| D4 | agent_id in system prompt | Claude needs identity to authenticate. System prompt is the bootstrap. |
| D5 | Per-agent monitor, not shared | Each agent has its own SSE connection. Clean lifecycle — terminate agent kills its monitor. |
