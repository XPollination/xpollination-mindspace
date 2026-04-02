# A2A Agent Work Delivery — Announce, Self-Select, Validate

**Ref:** MISSION-A2A-AGENT-DELIVERY
**Version:** v2.0.0
**Date:** 2026-04-02
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft

**Supersedes:** Agents Subscribe to Events (/m/p1BgvxBQ) [DEPRECATED]

---

## Management Abstract

Agents are contractors. They get work orders via A2A messages, execute the work, submit deliverables via A2A messages. They never enter the office (database). The A2A server is the only system with database access — it reads tasks, writes DNA, validates gates, and translates between the protocol and the database.

The model is **Announce → Self-Select → Validate**: the server announces available tasks to the room, idle agents claim, the server validates and delivers structured instructions, agents work and submit results, the server validates delivery against workflow gates. No dispatcher bottleneck. Scales horizontally.

**Constraint:** No Anthropic API key. Max plan only. Claude Code CLI in tmux is the only inference path.

---

## Part 1: Architecture — The Contractor Model

### Who Knows What

```
A2A SERVER (the office):
  ✓ Database (tasks, DNA, agents, transitions)
  ✓ Workflow rules (state machine, gates, role routing)
  ✓ Connected agents (role, status, heartbeat)
  ✓ Brain API access
  ✗ Does NOT think (LLM-less)

AGENT (the contractor):
  ✓ Its role (pdsa/dev/qa/liaison)
  ✓ A2A protocol (send/receive messages)
  ✓ Claude Code (inference via Max plan OAuth)
  ✗ NO database access
  ✗ NO interface-cli
  ✗ NO SQL
  ✗ NO direct workflow engine access
```

### The Protocol Flow

```
1. AGENT CONNECTS
   Agent → A2A: "I'm a PDSA agent, ready for work"
   Server → Agent: "Welcome. You're registered. Listen for announcements."

2. SERVER ANNOUNCES (heartbeat/cron finds pending task)
   Server → Room: "Task xyz available for role=pdsa"
   (All connected PDSA agents see this)

3. AGENT SELF-SELECTS
   Agent → A2A: "I claim task xyz"
   (Idle agent claims. Busy agents ignore.)

4. SERVER VALIDATES CLAIM
   Server checks: role matches? agent idle? gates pass?
   Server → DATABASE: UPDATE tasks SET status='active', claimed_by=agent
   Server → Agent: "Confirmed. Here is your work order:"
   {
     task_slug: "xyz",
     title: "Design the widget system",
     dna: { full DNA object },
     instructions: {
       read: ["description", "acceptance_criteria"],
       produce: ["findings", "proposed_design"],
       set: { "pdsa_ref": "GitHub URL of your design doc" },
       contribute_to_brain: true,
       transition_to: "approval"
     },
     gate_requirements: ["pdsa_ref must be GitHub URL", "brain contribution required"]
   }

5. AGENT WORKS
   Claude Code reads the work order, thinks, produces output.
   Agent has EVERYTHING it needs in the message — no DB queries needed.

6. AGENT DELIVERS
   Agent → A2A: "Task xyz complete. Results:"
   {
     task_slug: "xyz",
     findings: "Research shows...",
     proposed_design: "The approach is...",
     pdsa_ref: "https://github.com/...",
     brain_contribution: "Key learning from this task...",
     transition_to: "approval"
   }

7. SERVER VALIDATES DELIVERY
   Server checks gates: pdsa_ref is GitHub URL? ✓ Brain contributed? ✓
   Server → DATABASE: UPDATE tasks SET dna_json=..., status='approval'
   Server → Agent: "ACK. Task moved to approval."
   Server → Room: "APPROVAL_NEEDED for task xyz" (liaison agents see this)

8. SERVER CHECKS FOR MORE WORK
   Any more tasks for this agent's role?
   → Yes: announce to room again
   → No: agent stays idle, waiting for next announcement
```

### Why This Scales

| Aspect | Dispatcher (server-pushes) | Marketplace (agent-pulls) | **Hybrid (announce + self-select)** |
|--------|---------------------------|--------------------------|--------------------------------------|
| Coordination | Server manages each agent individually | None — agents fight over tasks | Server announces, agents self-select |
| Bottleneck | Server is O(tasks × agents) | None | None — announcing is O(1) broadcast |
| Fault tolerance | Server dies = all coordination stops | Agents have claimed tasks | Agents have claimed tasks + server validates |
| 50 agents join | Server must manage 50 conversations | 50 agents start pulling | 50 agents hear announcements, self-organize |
| 2 agents claim same task | N/A (server assigns) | Conflict resolution (lowest CID) | Server validates first claim, rejects second |
| Process changes | Update server conversation scripts | Update agent skills | **Update server instruction templates only** |

### The Key Separation

```
interface-cli  = for humans/LIAISON in tmux (direct DB access)
A2A messages   = for spawned agents (NO DB access, protocol only)
A2A server     = translates between protocol and database
```

The agent is a contractor: gets a work order (A2A message), does the work, submits the deliverable (A2A message). Never enters the office (database).

---

## Part 2: Complete Workflow — All Transitions

### PDSA Design Path (Happy Path)

| # | From | To | Actor | A2A Announcement | Target Role | Required DNA |
|---|------|-----|-------|-----------------|-------------|-------------|
| 1 | pending | ready | system/liaison | TASK_AVAILABLE | pdsa | depends_on_reviewed |
| 2 | ready | active | pdsa agent claims | CLAIM_CONFIRMED + instructions | — | memory_query_session |
| 3 | active | approval | pdsa delivers | APPROVAL_NEEDED | liaison | pdsa_ref, brain_contribution |
| 4 | approval | approved | human/liaison | TASK_AVAILABLE | qa | human_answer |
| 5 | approved | active | qa claims | CLAIM_CONFIRMED + instructions | — | memory_query_session |
| 6 | active | testing | qa delivers | — | — | qa_tests |
| 7 | testing | ready | qa | TASK_AVAILABLE | dev | — |
| 8 | ready | active | dev claims | CLAIM_CONFIRMED + instructions | — | memory_query_session |
| 9 | active | review | dev delivers | REVIEW_NEEDED | qa | implementation, brain_contribution |
| 10 | review+qa | review+pdsa | qa delivers review | REVIEW_NEEDED | pdsa | qa_review |
| 11 | review+pdsa | review+liaison | pdsa delivers review | REVIEW_NEEDED | liaison | pdsa_review |
| 12 | review+liaison | complete | human/liaison | — | — | abstract_ref, human_answer |

### Rework Paths

| # | From | To | Actor | A2A Announcement | Required DNA |
|---|------|-----|-------|-----------------|-------------|
| R1 | approval | rework | human/liaison | REWORK_NEEDED → pdsa | rework_reason |
| R2 | review+qa | rework | qa | REWORK_NEEDED → dev | rework_reason |
| R3 | review+pdsa | rework | pdsa | REWORK_NEEDED → target | rework_target_role |
| R4 | review+liaison | rework | human/liaison | REWORK_NEEDED → target | rework_target_role |
| R5 | complete | rework | human | REWORK_NEEDED → target | rework_target_role |
| R6 | rework | active | target role claims | CLAIM_CONFIRMED | memory_query_session |

### Blocked/Unblocked

| # | From | To | Actor | A2A Announcement | Required DNA |
|---|------|-----|-------|-----------------|-------------|
| B1 | any | blocked | any agent | TASK_BLOCKED → liaison | blocked_reason, from_state, from_role |
| B2 | blocked | restore | liaison/system | TASK_AVAILABLE (original role) | — |

---

## Part 3: Quality Gates (Hard Gates)

Enforced by the A2A server on EVERY delivery. No agent can bypass.

| Gate | When | What Server Checks | Rejects With |
|------|------|-------------------|--------------|
| **Dependency** | pending→ready | All depends_on tasks complete | "Dependencies not met" |
| **Brain query** | claim | memory_query_session present | "Must query brain before claiming" |
| **PDSA ref** | active→approval | pdsa_ref is GitHub URL | "Missing PDSA document" |
| **Brain contribute** | any active→transition | memory_contribution_id present | "Must contribute learnings" |
| **Human decision** | approval→approved | human_answer present | "Requires human approval" |
| **Abstract** | review→complete | abstract_ref is GitHub URL | "Missing completion abstract" |
| **Role consistency** | →complete/approval/approved/testing | Correct role assigned | "Wrong role for this state" |
| **Rework target** | →rework | rework_target_role set | "Must specify who fixes" |
| **Blocked reason** | →blocked | blocked_reason present | "Must explain why blocked" |

---

## Part 4: Instruction Templates (Server Configuration)

The A2A server sends instructions AFTER confirming a claim. These templates are **iterable** — change the template, all agents get new instructions. No agent changes needed.

### Per-Role Instruction Templates

**PDSA claims a task:**
```json
{
  "role": "pdsa",
  "instructions": {
    "read": ["title", "description", "acceptance_criteria", "context"],
    "do": "Research the problem. Design a solution following PDSA methodology.",
    "produce": {
      "findings": "Your research findings",
      "proposed_design": "Your design proposal with rationale",
      "pdsa_ref": "Push design doc to git, provide GitHub URL"
    },
    "brain": "Query brain for context before working. Contribute learnings after.",
    "transition_to": "approval",
    "gates": ["pdsa_ref must be GitHub URL", "brain contribution required"]
  }
}
```

**DEV claims a task:**
```json
{
  "role": "dev",
  "instructions": {
    "read": ["title", "description", "proposed_design", "acceptance_criteria", "qa_tests"],
    "do": "Implement the design. Follow the proposed approach. Make tests pass.",
    "produce": {
      "implementation": "Summary of what you built + commit hash",
      "test_pass_count": "Number of tests passing",
      "test_total_count": "Total number of tests"
    },
    "brain": "Query brain for implementation patterns. Contribute learnings after.",
    "transition_to": "review",
    "gates": ["implementation must be set", "brain contribution required"]
  }
}
```

**QA claims a review:**
```json
{
  "role": "qa",
  "instructions": {
    "read": ["title", "proposed_design", "implementation", "qa_tests"],
    "do": "Review implementation against design. Run tests. Verify acceptance criteria.",
    "produce": {
      "qa_review": "Your review verdict and reasoning"
    },
    "transition_to": "review (→pdsa)",
    "or_rework": "If implementation doesn't match design → rework with rework_reason"
  }
}
```

### Why This Is Iterable

| Change | What to update | Agent impact |
|--------|---------------|-------------|
| Add DNA field | Instruction template + quality gate | None — agents follow new instructions |
| Change review chain | Event routing config | None — server routes differently |
| Add new role | Instruction template + role map | Add new agent type, no existing changes |
| Tighten gate | Quality gate config | Agents get rejection + reason, adapt |

---

## Part 5: A2A Message Types

### Agent → Server

| Message | When | Payload |
|---------|------|---------|
| `REGISTER` | Agent connects | role, capabilities |
| `CLAIM` | Agent wants a task | task_slug |
| `DELIVER` | Agent completed work | task_slug, DNA fields, transition_to |
| `HEARTBEAT` | Every 25s | status (idle/busy) |
| `BLOCK` | Agent can't proceed | task_slug, blocked_reason |

### Server → Agent

| Message | When | Payload |
|---------|------|---------|
| `WELCOME` | After register | agent_id, room info |
| `TASK_AVAILABLE` | Task needs a role | task_slug, title, role, DNA summary |
| `CLAIM_CONFIRMED` | After validated claim | full DNA, structured instructions, gate requirements |
| `CLAIM_REJECTED` | Gate failed or already claimed | reason |
| `DELIVERY_ACCEPTED` | Gates passed | ACK, next event info |
| `DELIVERY_REJECTED` | Gate failed | which gate, what's missing |
| `REWORK_NEEDED` | Task returned for fixes | task_slug, rework_reason, instructions |

---

## Part 6: What Already Works

| Component | Status |
|-----------|--------|
| A2A server with SSE routing | Working |
| Workflow gates (9 types) | Working |
| Role consistency enforcement | Working |
| Event types + sendToRole | Working |
| Claude Code in tmux (+1 Dev) | Working |
| xterm.js terminal in browser | Working |
| Per-agent unblock | Working |
| Cascade engine | Working |
| Brain contribution gate | Working |

### What Needs to Be Built

| Component | What |
|-----------|------|
| **Instruction templates** | JSON config per role, loaded by A2A server |
| **TASK_AVAILABLE announcement** | Server heartbeat/cron finds tasks, announces to room |
| **CLAIM handling** | Agent sends CLAIM, server validates + sends instructions |
| **DELIVER handling** | Agent sends results, server writes DNA + validates gates |
| **Message delivery to Claude** | tmux send-keys with structured work order |
| **Result capture from Claude** | Agent sends A2A message (how?) |

### Open Question: How Does Claude Send A2A Messages?

The agent (Claude Code in tmux) needs to send CLAIM, DELIVER, HEARTBEAT messages back to the A2A server. Options:

1. **Bash curl** — Claude runs curl commands. Works but not protocol-native.
2. **MCP tool** — MCP wraps A2A calls. But MCP makes agents dependent on discovery order.
3. **A2A as chat** — The messages TO Claude are typed into the terminal. Claude's RESPONSES are captured and parsed by the server. The conversation IS the protocol.
4. **Hybrid** — Claude has a simple helper script (`a2a send "CLAIM" "task-xyz"`) that wraps the curl. Protocol-aware but simple.

---

## Part 7: Test Cases

### TC-1: PDSA Happy Path

```
Precondition: No agents. Task pending+pdsa.

1. Spawn PDSA (+1 PDSA)
2. Server announces: TASK_AVAILABLE for pdsa
3. PDSA agent claims via A2A message
4. Server validates → CLAIM_CONFIRMED with DNA + instructions
5. PDSA works (reads instructions, produces design)
6. PDSA delivers via A2A message (findings, pdsa_ref)
7. Server validates gates → DELIVERY_ACCEPTED
8. Server announces: APPROVAL_NEEDED for liaison
9. VERIFY: Task is now approval+liaison in DB
```

### TC-2: Rework

```
Precondition: Task at review+liaison.

1. LIAISON rejects → REWORK_NEEDED (target: dev)
2. DEV agent receives rework announcement
3. DEV claims rework
4. Server sends: CLAIM_CONFIRMED with rework instructions + reason
5. DEV fixes → delivers
6. Server validates → review chain resumes
```

### TC-3: Claim Conflict

```
Precondition: Two PDSA agents connected. One task announced.

1. Server announces: TASK_AVAILABLE for pdsa
2. Agent-A claims
3. Agent-B claims (slightly later)
4. Server validates A's claim first → CONFIRMED
5. Server rejects B's claim → CLAIM_REJECTED "already claimed"
6. Agent-B stays idle, waits for next announcement
```

### TC-4: Gate Rejection

```
Precondition: PDSA agent working on task.

1. PDSA delivers WITHOUT pdsa_ref
2. Server validates → gate fails
3. Server → DELIVERY_REJECTED "pdsa_ref must be GitHub URL"
4. PDSA reads rejection, adds pdsa_ref, delivers again
5. Server validates → DELIVERY_ACCEPTED
```

---

## Part 8: Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Hybrid: announce + self-select + validate | Scales horizontally. No dispatcher bottleneck. Server validates, agents self-organize. |
| D2 | Agent has NO database access | Contractor model. Work order in, deliverable out. All via A2A messages. |
| D3 | Server writes DNA on behalf of agents | Single source of truth. Server validates before writing. |
| D4 | Instruction templates in server config | Iterable. Change template → all agents follow new rules. No agent restart. |
| D5 | No Anthropic API key | Max plan only. Claude Code CLI is the only inference path. |
| D6 | No monitor sidecar | Reintroduced polling. Agents participate in A2A directly. |
| D7 | Events not chat for coordination | Announce to room, subscribers self-organize. Like package scanning. |
| D8 | interface-cli for humans, A2A for agents | Different access patterns. Humans query DB directly. Agents use protocol. |
| D9 | Workflow rules as twin (future) | Change the twin → change the workflow. No code deploy. Not yet implemented. |
