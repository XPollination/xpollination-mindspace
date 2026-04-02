# A2A Agent Work Delivery — Announce, Self-Select, Validate

**Ref:** MISSION-A2A-AGENT-DELIVERY
**Version:** v3.0.0
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

## Part 4: Config-Driven Workflow Engine

### The Problem with Current Implementation

Today the workflow is **spaghetti** — transitions, gates, role routing, and instructions are hardcoded across multiple files:

| What | Where | Problem |
|------|-------|---------|
| Valid transitions | `transaction-validator.ts` VALID_TRANSITIONS | Hardcoded map |
| Role enforcement | `a2a-message.ts` EXPECTED_ROLES_BY_STATE | Hardcoded object |
| Quality gates | `a2a-message.ts` QUALITY_GATES | Hardcoded object |
| Human confirm gates | `a2a-message.ts` HUMAN_CONFIRM_TRANSITIONS | Hardcoded Set |
| Event routing | `a2a-message.ts` if/else chain | Hardcoded conditionals |
| Instructions | Not implemented | N/A |

To change one gate: edit code → restart server → hope nothing breaks.

### The Solution: One Configuration File

**`workflow.yaml`** — the ONLY place the process is defined. The engine reads it and executes. Change the file, change the workflow.

```yaml
# workflow.yaml — source of truth for the entire PDSA process

transitions:
  pending:
    ready:
      actors: [system, liaison]
      gates: [dependency_check]
      event: TASK_AVAILABLE
      target_role: from_dna

  ready:
    active:
      actors: [matching_role]
      gates: [brain_query]
      event: CLAIM_CONFIRMED

  active:
    approval:
      actors: [pdsa]
      gates: [pdsa_ref_github, brain_contribute]
      event: APPROVAL_NEEDED
      target_role: liaison
    review:
      actors: [dev, qa, liaison]
      gates: [brain_contribute]
      event: REVIEW_NEEDED
      target_role: from_review_chain
    blocked:
      actors: [any]
      gates: [blocked_reason]
      event: TASK_BLOCKED
      target_role: liaison

  approval:
    approved:
      actors: [liaison]
      gates: [human_answer]
      event: TASK_AVAILABLE
      target_role: qa
    rework:
      actors: [liaison]
      gates: [human_answer, rework_reason]
      event: REWORK_NEEDED
      target_role: pdsa
    complete:
      actors: [liaison]
      gates: [human_answer, abstract_ref]
      event: null

  approved:
    active:
      actors: [qa]
      gates: [brain_query]
      event: CLAIM_CONFIRMED
    testing:
      actors: [qa]
      gates: []
      event: null

  testing:
    ready:
      actors: [qa]
      gates: []
      event: TASK_AVAILABLE
      target_role: dev
    rework:
      actors: [qa]
      gates: [rework_reason]
      event: REWORK_NEEDED
      target_role: from_rework_target

  review:
    complete:
      actors: [liaison]
      gates: [abstract_ref, human_answer]
      event: null
    rework:
      actors: [liaison, qa, pdsa]
      gates: [rework_target]
      event: REWORK_NEEDED
      target_role: from_rework_target
    review:  # same-state transition (review chain)
      actors: [qa, pdsa]
      gates: []
      event: REVIEW_NEEDED
      target_role: from_review_chain

  rework:
    active:
      actors: [matching_role]
      gates: [brain_query]
      event: CLAIM_CONFIRMED

  blocked:
    restore:
      actors: [liaison, system]
      gates: []
      event: TASK_AVAILABLE
      target_role: from_blocked_state

gates:
  dependency_check:
    validate: "all depends_on tasks have status=complete"
    error: "Dependencies not met: {failing_slugs}"

  brain_query:
    field: memory_query_session
    validate: non_empty
    error: "Must query brain before claiming"

  pdsa_ref_github:
    field: pdsa_ref
    validate: github_url
    error: "pdsa_ref must be a GitHub URL"

  brain_contribute:
    field: memory_contribution_id
    validate: non_empty
    error: "Must contribute learnings to brain"

  human_answer:
    field: human_answer
    validate: min_length_10
    error: "Requires human decision text (min 10 chars)"

  abstract_ref:
    field: abstract_ref
    validate: github_url
    error: "abstract_ref must be a GitHub URL"

  blocked_reason:
    field: blocked_reason
    validate: non_empty
    error: "Must explain why blocked"

  rework_reason:
    field: rework_reason
    validate: non_empty
    error: "Must explain what needs fixing"

  rework_target:
    field: rework_target_role
    validate: one_of [pdsa, dev, qa, liaison]
    error: "Must specify who fixes (pdsa/dev/qa/liaison)"

validators:
  non_empty: "value !== null && value !== '' && value !== undefined"
  github_url: "value.startsWith('https://github.com/')"
  min_length_10: "value.length >= 10"
  one_of: "allowed_values.includes(value)"

role_routing:
  fixed_roles:
    complete: liaison
    approval: liaison
    approved: qa
    testing: qa
    cancelled: liaison

  review_chain:
    - { from: dev, next: qa }
    - { from: qa, next: pdsa }
    - { from: pdsa, next: liaison }

instructions:
  pdsa:
    read: [title, description, acceptance_criteria, context]
    do: "Research the problem. Design a solution following PDSA methodology."
    produce:
      findings: "Your research findings"
      proposed_design: "Your design proposal with rationale"
      pdsa_ref: "Push design doc to git, provide GitHub URL"
    brain: "Query brain for context before working. Contribute learnings after."
    transition_to: approval

  dev:
    read: [title, description, proposed_design, acceptance_criteria, qa_tests]
    do: "Implement the design. Follow the proposed approach. Make tests pass."
    produce:
      implementation: "Summary of what you built + commit hash"
      test_pass_count: "Number of tests passing"
      test_total_count: "Total tests"
    brain: "Query brain for patterns. Contribute learnings after."
    transition_to: review

  qa_test:
    read: [title, proposed_design, acceptance_criteria]
    do: "Write tests for the approved design. Cover acceptance criteria."
    produce:
      qa_tests: "Test descriptions and file locations"
    transition_to: ready

  qa_review:
    read: [title, proposed_design, implementation, qa_tests]
    do: "Review implementation against design. Run tests. Verify acceptance criteria."
    produce:
      qa_review: "Your review verdict and reasoning"
    transition_to: review
    or_rework: "If tests fail → rework with rework_reason"

  liaison_review:
    read: [title, findings, implementation, qa_review, pdsa_review]
    do: "Present to Thomas. Summarize work done, reviews passed, ready for approval."
    produce:
      liaison_review: "Summary for human review"
      human_answer: "Thomas's decision"
    transition_to: complete
```

### The Engine (generic, never changes)

```
function processTransition(from_status, to_status, actor, dna, config):
  # 1. Look up transition in config
  transition = config.transitions[from_status][to_status]
  if not transition → REJECT "Invalid transition"

  # 2. Check actor is allowed
  if actor not in transition.actors → REJECT "Actor not allowed"

  # 3. Run each gate
  for gate_name in transition.gates:
    gate = config.gates[gate_name]
    validator = config.validators[gate.validate]
    value = dna[gate.field]
    if not validator(value) → REJECT gate.error

  # 4. Determine target role
  target_role = resolve_role(transition.target_role, config, dna)

  # 5. Execute
  UPDATE database (status, role, dna)
  
  # 6. Send event
  if transition.event:
    instructions = config.instructions[target_role]
    SEND to_room(transition.event, {task, dna, instructions})

  return ACK
```

### What Changes When the Process Changes

| Change | Edit | Code change? | Restart? |
|--------|------|-------------|---------|
| Add new DNA field gate | `gates:` section | No | Hot-reload |
| Change who can transition | `actors:` list | No | Hot-reload |
| Add new transition | `transitions:` entry | No | Hot-reload |
| Remove a transition | Delete entry | No | Hot-reload |
| Change review chain order | `review_chain:` | No | Hot-reload |
| Change agent instructions | `instructions:` | No | Hot-reload |
| Add new role | role_routing + instructions | No | Hot-reload |
| Add new validator type | `validators:` | No | Hot-reload |
| Change gate error message | `gates:` error field | No | Hot-reload |

**Zero code changes. Zero agent changes. The config IS the workflow.**

Future: the config file becomes a twin. Change the twin → change the workflow. No file edit, no deploy. Twin evolution = workflow evolution.

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
| `DELIVERY_REJECTED` | Gate failed | which gate, what's missing, what's expected |
| `REWORK_NEEDED` | Task returned for fixes | task_slug, rework_reason, instructions |

---

## Part 6: What Already Works vs What Needs Building

### Works

| Component | Status |
|-----------|--------|
| A2A server with SSE routing | Working |
| Workflow gates (9 types, hardcoded) | Working but needs extraction to config |
| Role consistency enforcement | Working but hardcoded |
| Event types + sendToRole | Working |
| Claude Code in tmux (+1 Dev) | Working |
| xterm.js terminal in browser | Working |
| Per-agent unblock | Working |
| Cascade engine | Working |

### Needs Building

| Component | What | Priority |
|-----------|------|----------|
| **workflow.yaml** | Config file defining all transitions, gates, validators, instructions | 1 |
| **Config-driven engine** | Generic engine that reads workflow.yaml and executes | 1 |
| **TASK_AVAILABLE cron** | Heartbeat that finds pending tasks and announces to room | 2 |
| **CLAIM/DELIVER handlers** | A2A message handlers for agent claims and deliveries | 2 |
| **Instruction delivery** | tmux send-keys with structured work order from config | 3 |
| **Result capture** | How Claude sends A2A messages back (curl helper or A2A chat) | 3 |

---

## Part 7: End-to-End Test Plan

### Preconditions (ALL tests)

```
1. Terminate ALL agents: for each agent → DELETE /api/team/all/agent/{id}
2. Kill ALL tmux: docker exec mindspace-test tmux kill-server
3. Verify clean: agents=0, tmux=0, sse=0
4. Verify tasks exist in expected states
5. Screenshots taken via Chrome CDP at each verification step
```

### TC-1: PDSA Happy Path (full 12-step flow)

```
Precondition: Task "test-tc1" in pending+pdsa

STEP 1: Spawn PDSA agent
  ACTION: POST /api/team/all/agent {"role":"pdsa"}
  VERIFY: 3 tmux sessions, SSE=1, agent registered
  SCREENSHOT: kanban showing PDSA agent

STEP 2: Server announces task
  ACTION: Transition test-tc1 pending→ready (triggers TASK_AVAILABLE to pdsa)
  VERIFY: PDSA agent receives TASK_AVAILABLE message
  VERIFY: Message contains: task_slug, title, DNA summary
  SCREENSHOT: PDSA terminal showing received task

STEP 3: Agent claims
  ACTION: PDSA sends CLAIM for test-tc1
  VERIFY: Server validates → CLAIM_CONFIRMED
  VERIFY: Server sends full DNA + instructions from workflow.yaml
  VERIFY: DB shows status=active, claimed_by=agent
  VERIFY: Gate checked: memory_query_session present

STEP 4: Agent works + delivers
  ACTION: PDSA produces findings, proposed_design
  ACTION: PDSA sends DELIVER {findings, proposed_design, pdsa_ref, brain_contribution}
  VERIFY: Server validates gates: pdsa_ref is GitHub URL ✓, brain contributed ✓
  VERIFY: Server writes DNA to DB
  VERIFY: Server sends DELIVERY_ACCEPTED
  VERIFY: DB shows status=approval, role=liaison

STEP 5: Server announces approval needed
  VERIFY: APPROVAL_NEEDED event sent to liaison role
  SCREENSHOT: kanban showing task in APPROVAL column

STEP 6: Human approves (via LIAISON)
  ACTION: LIAISON sends DELIVER {human_answer: "approved"}
  VERIFY: Gate: human_answer present ✓
  VERIFY: DB shows status=approved, role=qa

STEP 7-8: QA writes tests → ready for dev
  ACTION: Spawn QA (+1 QA), QA claims, produces qa_tests
  VERIFY: QA delivers → status=ready, role=dev
  VERIFY: TASK_AVAILABLE sent to dev role

STEP 9-10: DEV implements → review
  ACTION: Spawn DEV (+1 DEV), DEV claims, produces implementation
  VERIFY: DEV delivers → status=review, role=qa
  VERIFY: REVIEW_NEEDED sent to qa role

STEP 11: Review chain (qa → pdsa → liaison)
  VERIFY: QA reviews → review+pdsa (same-state, role change)
  VERIFY: PDSA reviews → review+liaison
  VERIFY: Each step validated by engine

STEP 12: Complete
  ACTION: LIAISON delivers {abstract_ref, human_answer}
  VERIFY: Gates: abstract_ref GitHub URL ✓, human_answer ✓
  VERIFY: DB shows status=complete, role=liaison
  VERIFY: Cascade engine runs (unblocks dependents)
  SCREENSHOT: kanban showing task in COMPLETE column

TOTAL GATES CHECKED: 9 (dependency, brain_query x3, pdsa_ref, brain_contribute x3, human_answer x2, abstract_ref)
```

### TC-2: Gate Rejection + Retry

```
Precondition: PDSA agent working on task test-tc2

STEP 1: PDSA delivers WITHOUT pdsa_ref
  VERIFY: Server returns DELIVERY_REJECTED
  VERIFY: Error message: "pdsa_ref must be a GitHub URL"
  VERIFY: DB status unchanged (still active)
  SCREENSHOT: terminal showing rejection message

STEP 2: PDSA delivers WITH pdsa_ref but bad URL
  ACTION: DELIVER {pdsa_ref: "not-a-url"}
  VERIFY: DELIVERY_REJECTED "pdsa_ref must be a GitHub URL"

STEP 3: PDSA delivers WITH correct pdsa_ref but missing brain
  ACTION: DELIVER {pdsa_ref: "https://github.com/..."}
  VERIFY: DELIVERY_REJECTED "Must contribute learnings to brain"

STEP 4: PDSA delivers WITH all fields correct
  ACTION: DELIVER {pdsa_ref: "https://github.com/...", brain_contribution: "..."}
  VERIFY: DELIVERY_ACCEPTED
  VERIFY: DB status=approval
```

### TC-3: Rework Path

```
Precondition: Task at review+liaison, DEV agent connected

STEP 1: LIAISON rejects with rework_target_role=dev
  ACTION: DELIVER {transition_to: "rework", rework_target_role: "dev", rework_reason: "tests fail"}
  VERIFY: DB status=rework, role=dev
  VERIFY: REWORK_NEEDED sent to dev role with rework_reason

STEP 2: DEV receives rework
  VERIFY: DEV agent receives REWORK_NEEDED with reason + instructions
  SCREENSHOT: DEV terminal showing rework instructions

STEP 3: DEV claims rework
  ACTION: DEV sends CLAIM for task
  VERIFY: CLAIM_CONFIRMED with rework context in instructions

STEP 4: DEV fixes + delivers
  VERIFY: active→review transition
  VERIFY: Review chain resumes from qa
```

### TC-4: Rework without target role (rejection)

```
STEP 1: LIAISON tries rework WITHOUT rework_target_role
  VERIFY: DELIVERY_REJECTED "Must specify who fixes (pdsa/dev/qa/liaison)"
  VERIFY: DB unchanged
```

### TC-5: Blocked + Restore

```
Precondition: Task at active+dev

STEP 1: DEV blocks task
  ACTION: BLOCK {task_slug, blocked_reason: "Brain API down"}
  VERIFY: DB status=blocked, from_state=active, from_role=dev
  VERIFY: TASK_BLOCKED sent to liaison
  SCREENSHOT: kanban showing task in BLOCKED column

STEP 2: LIAISON restores
  ACTION: DELIVER {transition_to: "restore"}
  VERIFY: DB status=active, role=dev (restored from blocked_from_*)
  VERIFY: TASK_AVAILABLE sent to dev role
  SCREENSHOT: kanban showing task back in ACTIVE column
```

### TC-6: Claim Conflict (two agents, one task)

```
Precondition: Two DEV agents connected (DEV-A, DEV-B)

STEP 1: Server announces TASK_AVAILABLE for dev
  VERIFY: Both agents receive announcement

STEP 2: DEV-A claims first
  VERIFY: CLAIM_CONFIRMED for DEV-A
  VERIFY: DB claimed_by=DEV-A

STEP 3: DEV-B claims same task
  VERIFY: CLAIM_REJECTED "Task already claimed"
  VERIFY: DEV-B stays idle
```

### TC-7: Invalid Transition

```
STEP 1: DEV tries active→complete (skipping review)
  VERIFY: DELIVERY_REJECTED "Invalid transition: active→complete"
  VERIFY: DB unchanged

STEP 2: QA tries to claim a PDSA task
  VERIFY: CLAIM_REJECTED "Actor not allowed" (role mismatch)
```

### TC-8: Review Chain (same-state transitions)

```
Precondition: Task at review+qa

STEP 1: QA delivers review
  VERIFY: review→review transition (same state, role changes qa→pdsa)
  VERIFY: REVIEW_NEEDED sent to pdsa
  VERIFY: DB role=pdsa (not qa)

STEP 2: PDSA delivers review
  VERIFY: review→review (pdsa→liaison)
  VERIFY: REVIEW_NEEDED sent to liaison

STEP 3: LIAISON delivers complete
  VERIFY: review→complete
  VERIFY: Gates: abstract_ref + human_answer
```

### TC-9: Config Change (zero-code workflow update)

```
Precondition: Workflow working with standard gates

STEP 1: Add new gate to workflow.yaml
  ACTION: Add gate "implementation_min_length" requiring implementation.length > 50
  ACTION: Add to active→review gates list

STEP 2: DEV delivers with short implementation
  VERIFY: DELIVERY_REJECTED "Implementation must be at least 50 characters"

STEP 3: DEV delivers with long implementation
  VERIFY: DELIVERY_ACCEPTED

STEP 4: Remove the gate from config
  VERIFY: Short implementation now accepted (gate removed)
  VERIFY: No code change, no restart
```

---

## Part 8: Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Hybrid: announce + self-select + validate | Scales horizontally. No dispatcher bottleneck. |
| D2 | Agent has NO database access | Contractor model. Work order in, deliverable out. |
| D3 | Server writes DNA on behalf of agents | Single source of truth. Validates before writing. |
| D4 | Config-driven workflow engine | One YAML file defines all transitions, gates, validators, instructions. Zero code changes for process updates. |
| D5 | No Anthropic API key | Max plan only. Claude Code CLI is the only inference path. |
| D6 | No monitor sidecar | Reintroduced polling. Agents participate in A2A directly. |
| D7 | Events not chat for coordination | Announce to room, subscribers self-organize. |
| D8 | interface-cli for humans, A2A for agents | Different access patterns. |
| D9 | Workflow config as twin (future) | Change the twin → change the workflow. No file edit, no deploy. |
| D10 | Generic engine + specific config | Engine never changes. Config changes for every process update. |
