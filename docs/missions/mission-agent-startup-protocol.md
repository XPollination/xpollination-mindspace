# Agent Startup Protocol — Brain-First Recovery, Prompt-Driven Handshake

**Ref:** MISSION-AGENT-STARTUP-PROTOCOL
**Version:** v1.0.0
**Date:** 2026-04-08
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Active — ready for implementation
**Depends on:** MISSION-A2A-AGENT-BODY (xpo-agent.js — proven working)

---

## The Insight

The body (xpo-agent.js) controls what the soul (LLM) sees and when. The startup sequence is a series of prompts. Change the prompts → change the behavior. No code change needed.

Role knowledge lives in **brain**, not in code. Every startup queries brain for the latest role definition. When we add wisdom to brain, agents wake up with it automatically. The autobahnen get stronger with every startup.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        xpo-agent (body)                         │
│                                                                 │
│  1. Launch LLM in tmux                                          │
│  2. Wait for LLM ready (pane_current_command = claude)          │
│  3. Connect to A2A → get agent_id                               │
│  4. Send startup prompts to LLM:                                │
│     ┌─────────────────────────────────────────────────────────┐  │
│     │  PROMPT 1: "Query brain for your role definition"       │  │
│     │  PROMPT 2: "Check approval mode" (LIAISON only)         │  │
│     │  PROMPT 3: "Query A2A for your current tasks"           │  │
│     │  PROMPT 4: "Confirm you are ready"                      │  │
│     └─────────────────────────────────────────────────────────┘  │
│  5. Wait for LLM to confirm READY                               │
│  6. Open SSE stream → start forwarding events                   │
│                                                                 │
│  Body never changes for role knowledge.                         │
│  Prompts are the protocol. Brain is the knowledge.              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Startup Sequence (5 Steps)

### Step 1: Launch & Wait

Body creates tmux session, launches LLM, waits until LLM is at prompt.

```
Body: tmux new-session → send-keys "cd {workspace} && claude ..."
Body: poll pane_current_command until "claude"
Body: LLM is ready to receive prompts
```

No SSE connection yet. No events. LLM boots in silence.

### Step 2: Brain Recovery (all roles)

Body sends the first prompt. LLM reads brain for its role definition.

```
Body → LLM:
  "You are the {ROLE} agent. Before doing anything, recover your role
   definition from the shared brain:

   curl -s -X POST {brain_url}/api/v1/memory \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer {brain_key}' \
     -d '{"prompt":"Recovery protocol and role definition for {ROLE} agent.
          What are my responsibilities, boundaries, and latest operational
          learnings?",
          "agent_id":"agent-{role}",
          "agent_name":"{ROLE}",
          "session_id":"{session_id}",
          "read_only":true}'

   Read the result carefully. It defines who you are and what you must
   never do. This is your foundation."
```

**What brain returns** (current state, evolves over time):

| Role | Brain returns |
|------|-------------|
| LIAISON | Human bridge. Creates tasks with complete DNA. Presents reviews. Executes human decisions. NEVER implements, designs, or tests. 3 documented violations. |
| PDSA | Plans, researches, designs. Produces PDSA documents. Verifies dev implementation matches design. NEVER implements code. |
| DEV | Implements what PDSA designed. Feature branches from develop. Git protocol: specific staging, atomic commits, immediate push. NEVER plans, NEVER changes tests. |
| QA | Writes tests (tests ARE the specification). Reviews implementations. NEVER fixes implementation code — writes failing tests that expose bugs. |

**Why this is the cornerstone:** We don't hardcode role knowledge. Brain evolves. Corrections get added. Next startup, the LLM reads the correction. The autobahnen (high-traffic brain highways) for role definitions get reinforced with every agent startup.

### Step 2b: Approval Mode (LIAISON only)

LIAISON must know its operating mode before receiving any tasks.

```
Body → LLM (only for role=liaison):
  "Check your approval mode:

   curl -s {api_url}/api/settings/liaison-approval-mode

   Modes:
   - autonomous: You decide. Approve/reject immediately. Document reasoning
     in liaison_reasoning. Do NOT ask Thomas. Do NOT wait. The mode IS the
     answer. You also proactively drive the pipeline — create pending→ready
     transitions, ensure agents have work.
   - semi: Present full task details. STOP. Wait for Thomas to type his
     decision. Do NOT proceed until Thomas responds.
   - manual: Present details. Tell Thomas to click Confirm in viz UI. STOP.
   - auto-approval: Same as autonomous for approval transitions. Thomas
     decides on completions.

   CRITICAL: Check mode BEFORE every decision transition. Thomas can change
   it at any time via the viz dropdown. Never cache the mode."
```

### Step 3: Task State (all roles)

LLM queries A2A for tasks assigned to its role.

```
Body → LLM:
  "Query your current task state:

   curl -s -X POST {api_url}/a2a/message \
     -H 'Content-Type: application/json' \
     -d '{"agent_id":"{agent_id}",
          "type":"OBJECT_QUERY",
          "object_type":"task",
          "filters":{"current_role":"{role}"}}'

   Report: how many tasks, what statuses, any that need immediate action."
```

### Step 4: Handshake

LLM confirms it recovered context and is ready.

```
Body → LLM:
  "Confirm you are ready. State:
   1. Your role and key boundaries
   2. Number of tasks assigned to you
   3. READY

   The A2A event stream will start delivering [TASK] messages after you
   confirm."

LLM → (responds in terminal):
  "I am PDSA. I plan and design, never implement. 2 tasks pending. READY."
```

Body detects "READY" in the tmux pane output → opens SSE → starts forwarding events.

### Step 5: SSE Events Flow

Only now does the body connect to SSE and forward events.

```
Body: POST /a2a/connect → agent_id
Body: GET /a2a/stream/{agent_id} → SSE connected
Body: forward task_available, approval_needed, review_needed → tmux send-keys
LLM: receives [TASK] messages, does work, delivers via a2a-deliver.js
```

---

## Timing Diagram

```
Time ──────────────────────────────────────────────────────────────────►

Body:   [create tmux] [wait for claude] [connect A2A]
                                         │
                                    send prompt 1
                                    (brain query)
                                         │
LLM:                    [boot]     [read brain]──[respond]
                                                      │
Body:                                            send prompt 2
                                                 (approval mode)
                                                      │        LIAISON
LLM:                                             [check mode]──[respond]  only
                                                                   │
Body:                                                         send prompt 3
                                                              (task query)
                                                                   │
LLM:                                                          [query A2A]──[respond]
                                                                               │
Body:                                                                     send prompt 4
                                                                          (confirm ready)
                                                                               │
LLM:                                                                      "READY"
                                                                               │
Body:                                                                     [open SSE]
                                                                          [forward events]
                                                                               │
LLM:                                                                      [TASK] arrives
                                                                          [does work]
                                                                          [delivers]
```

**No timing issues.** Each step waits for the previous to complete. No events arrive before the LLM is ready. The body controls the sequence.

---

## What Lives Where

```
┌──────────────────────┐     ┌──────────────────────┐
│  xpo-agent.js (body) │     │  Brain (knowledge)   │
│                      │     │                      │
│  • Startup sequence  │     │  • Role definitions  │
│  • SSE connection    │     │  • Boundaries        │
│  • Event forwarding  │     │  • Violations        │
│  • Heartbeat         │     │  • Corrections       │
│  • Shutdown cleanup  │     │  • Operational       │
│                      │     │    learnings          │
│  NEVER changes for   │     │  ALWAYS evolving     │
│  role knowledge      │     │                      │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           │  sends prompts             │  returns knowledge
           │                            │
           ▼                            ▼
┌──────────────────────────────────────────────────┐
│  LLM (soul)                                      │
│                                                  │
│  • Reads brain → knows its role                  │
│  • Reads tasks → knows its state                 │
│  • Receives [TASK] → does work                   │
│  • Delivers results → A2A transition             │
│                                                  │
│  ANY LLM: Claude, ChatGPT, Ollama               │
└──────────────────────────────────────────────────┘
```

---

## The Autobahn Effect

Every agent startup queries brain for role definitions. This reinforces the brain highways:

| Highway | Current weight | Accesses |
|---------|---------------|----------|
| LIAISON role identity | 3.57 | 124 |
| DEV role definition | growing | 13+ |
| QA role definition | growing | 10+ |
| Agent coordination patterns | high | 260+ |

When we add new wisdom (e.g., "LIAISON must check approval mode before EVERY transition"), it attaches to the existing highway. Next startup, the agent reads it. No code change. No prompt edit. Brain evolves → agents evolve.

**Example evolution:**
1. Today: brain says "LIAISON NEVER implements code"
2. Tomorrow: Thomas adds "LIAISON must also verify task DNA has all 9 fields before approving"
3. Next LIAISON startup: brain returns both rules. LIAISON knows.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Role knowledge in brain, not code | Brain evolves. Code is frozen at deploy time. Agents should wake up with the latest. |
| D2 | Body waits for LLM ready before connecting SSE | Eliminates timing issues. No events arrive before LLM can receive them. |
| D3 | Prompt-driven handshake | Body sends prompts, LLM reads and responds. Change prompts → change behavior. Same body for all LLMs. |
| D4 | LIAISON checks approval mode at startup | Mode determines behavior for entire session. Must know before receiving any tasks. |
| D5 | "READY" confirmation before event forwarding | Explicit handshake. Body knows LLM has recovered context. No guessing. |
