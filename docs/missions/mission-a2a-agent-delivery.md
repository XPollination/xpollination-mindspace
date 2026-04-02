# A2A Agent Work Delivery — LLM-less Server Coordinates Claude Code Agents

**Ref:** MISSION-A2A-AGENT-DELIVERY
**Version:** v1.0.0
**Date:** 2026-04-02
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft

**Supersedes:** Agents Subscribe to Events (/m/p1BgvxBQ) [DEPRECATED]

---

## Management Abstract

The A2A server (LLM-less) coordinates Claude Code agents running in interactive terminals. Agents spawn via "+1 Dev" in kanban, authenticate via Max plan OAuth, and receive structured instructions from the A2A server. The server knows the workflow, enforces gates, and sends tasks to the right agent. Agents work, write DNA, and report back via A2A messages. The process logic lives in the SERVER configuration (iterable without code deploys), not in the agents.

**Constraint:** No Anthropic API key. Max plan subscription only. Claude Code CLI is the only inference path. The `a2a-event-handler.js` (API-based) cannot be used.

---

## Part 1: Architecture

```
A2A Server (LLM-less coordinator)
  ├── Knows: connected agents, their roles, their status
  ├── Knows: workflow transitions, quality gates, review chain
  ├── Knows: task DNA, required fields per transition
  │
  ├── On task ready+pdsa:
  │   → Find active PDSA agent
  │   → Send TASK_ASSIGNED with full DNA via SSE
  │   → Agent receives in Claude Code terminal
  │   → Agent reads DNA, works, writes results
  │   → Agent sends TRANSITION via curl to A2A
  │   → Server validates gates → ACK or ERROR
  │   → Server routes to next role
  │
  └── On task complete:
      → Cascade engine unblocks dependents
      → Brain contribution confirmed
      → Kanban UI updates via SSE broadcast
```

### Why LLM-less server

The A2A server is NOT an AI. It's a workflow engine with SSE event routing. Benefits:
- **Iterable process:** Change the workflow config → all agents follow new rules. No agent redeployment.
- **Deterministic gates:** Quality gates are code, not LLM judgment. They pass or fail.
- **Auditable:** Every transition logged with actor, timestamp, gate results.
- **Fast:** No inference latency on routing. Milliseconds, not minutes.

---

## Part 2: Complete Workflow — All Transitions

### PDSA Design Path (Happy Path)

| # | From State | To State | Actor | Event Sent | Target Role | Required DNA |
|---|-----------|----------|-------|------------|-------------|-------------|
| 1 | pending | ready | system/liaison | TASK_ASSIGNED | pdsa | depends_on_reviewed |
| 2 | ready | active | pdsa | — | — | memory_query_session |
| 3 | active | approval | pdsa | APPROVAL_NEEDED | liaison | pdsa_ref, memory_contribution_id |
| 4 | approval | approved | human/liaison | TASK_ASSIGNED | qa | human_answer |
| 5 | approved | active | qa | — | — | memory_query_session |
| 6 | active | testing | qa | — | — | — |
| 7 | testing | ready | qa | TASK_ASSIGNED | dev | — |
| 8 | ready | active | dev | — | — | memory_query_session |
| 9 | active | review | dev | REVIEW_NEEDED | qa | implementation, brain_contribution_id |
| 10 | review+qa | review+pdsa | qa | REVIEW_NEEDED | pdsa | qa_review |
| 11 | review+pdsa | review+liaison | pdsa | REVIEW_NEEDED | liaison | pdsa_review |
| 12 | review+liaison | complete | human/liaison | — | — | abstract_ref, human_answer |

### Rework Paths

| # | From State | To State | Actor | Event Sent | Target Role | Required DNA |
|---|-----------|----------|-------|------------|-------------|-------------|
| R1 | approval | rework | human/liaison | REWORK_NEEDED | pdsa | rework_reason |
| R2 | review+qa | rework | qa | REWORK_NEEDED | dev | rework_reason |
| R3 | review+pdsa | rework | pdsa | REWORK_NEEDED | dev/pdsa | rework_target_role |
| R4 | review+liaison | rework | human/liaison | REWORK_NEEDED | dev/pdsa/qa | rework_target_role |
| R5 | complete | rework | human | REWORK_NEEDED | dev/pdsa/qa | rework_target_role |
| R6 | rework | active | assigned role | — | — | memory_query_session |

### Blocked/Unblocked

| # | From State | To State | Actor | Event Sent | Required DNA |
|---|-----------|----------|-------|------------|-------------|
| B1 | any | blocked | any agent | TASK_BLOCKED → liaison | blocked_reason |
| B2 | blocked | (restore) | liaison/system | TASK_ASSIGNED | — |

### Liaison Content Path (simplified)

| # | From State | To State | Actor | Event Sent |
|---|-----------|----------|-------|------------|
| L1 | pending | ready | liaison | — |
| L2 | ready | active | liaison | — |
| L3 | active | review | liaison | — |
| L4 | review | complete | human/liaison | — |

---

## Part 3: Quality Gates (Hard Gates)

These are enforced by the A2A server on EVERY transition. No agent can bypass them.

| Gate | Transition | Required DNA | Validation |
|------|-----------|-------------|------------|
| **Dependency** | pending→ready | depends_on_reviewed=true | All depends_on tasks complete |
| **Brain query** | ready→active | memory_query_session | Agent queried brain before claiming |
| **PDSA ref** | active→approval | pdsa_ref | Must be GitHub URL |
| **Brain contribute** | active→review/approval | memory_contribution_id | Agent contributed learnings |
| **Human decision** | approval→approved/rework | human_answer | Thomas's decision text |
| **Abstract** | review→complete | abstract_ref | Must be GitHub URL |
| **Role consistency** | →complete/approval/approved/testing | fixed role | Engine rejects wrong role |
| **Rework target** | review→rework, complete→rework | rework_target_role | Must specify who fixes |
| **Blocked reason** | any→blocked | blocked_reason | Must explain why |

---

## Part 4: Event-to-Instruction Mapping

The A2A server sends events. Each event must contain the INSTRUCTIONS for the receiving agent. This is the **iterable process configuration** — change the instruction template, all agents get new instructions.

### TASK_ASSIGNED instruction

```
When A2A server sends TASK_ASSIGNED to a PDSA agent:

{
  event: "task_assigned",
  task_slug: "theia-docker-compose",
  title: "Add Theia to docker-compose",
  role: "pdsa",
  dna: { full task DNA object },
  available_transitions: ["active", "blocked"],
  instruction: {
    steps: [
      "1. Read the task DNA above",
      "2. Query brain for context: task title + related knowledge",
      "3. Produce a PDSA design document",
      "4. Write findings to DNA field: findings",
      "5. Write design to DNA field: proposed_design",
      "6. Set pdsa_ref to the GitHub URL of your design doc",
      "7. Contribute learnings to brain",
      "8. Transition to: approval"
    ],
    required_output: {
      "findings": "Your research findings",
      "proposed_design": "Your design proposal",
      "pdsa_ref": "GitHub URL"
    },
    transition_to: "approval",
    gate_requirements: ["pdsa_ref must be GitHub URL", "memory_contribution_id must be set"]
  }
}
```

### Per-Role Instructions

| Event | Role | Instruction Summary | Expected Output DNA | Transition To |
|-------|------|--------------------|--------------------|---------------|
| TASK_ASSIGNED | pdsa | Research + design | findings, proposed_design, pdsa_ref | approval |
| TASK_ASSIGNED | dev | Implement design | implementation, commit | review |
| TASK_ASSIGNED | qa | Write tests | qa_tests, test_pass_count | ready (for dev) |
| REVIEW_NEEDED | qa | Review implementation | qa_review | review (→pdsa) |
| REVIEW_NEEDED | pdsa | Verify design match | pdsa_review | review (→liaison) |
| REVIEW_NEEDED | liaison | Present to Thomas | liaison_review, human_answer | complete |
| APPROVAL_NEEDED | liaison | Present design to Thomas | human_answer | approved or rework |
| REWORK_NEEDED | any | Fix the issue | rework_context | review or approval |

### Why this is iterable

The instruction templates are in the A2A server, NOT in the agents. When the process changes:
- Add a new required DNA field → update the instruction template + add a quality gate
- Change the review chain → update the event routing config
- Add a new role → add instruction template + update EXPECTED_ROLES_BY_STATE

No agent code changes. No agent restarts. The server sends different instructions.

---

## Part 5: What Already Works

| Component | Status | Where |
|-----------|--------|-------|
| A2A server with SSE routing | Working | api/routes/a2a-*.ts |
| Workflow gates (7 types) | Working | QUALITY_GATES in a2a-message.ts |
| Role consistency enforcement | Working | EXPECTED_ROLES_BY_STATE |
| Event types (5: assigned, review, approval, rework, blocked) | Working | event-types.ts |
| Claude Code in tmux via +1 Dev | Working | api/routes/team.ts |
| xterm.js terminal in browser | Working | kanban.html + terminal-ws.ts |
| Per-agent unblock | Working | unblock tmux session |
| SSE push to role | Working | sendToRole() in sse-manager.ts |
| Cascade engine (unblock dependents) | Working | cascade-engine.ts |
| Brain contribution gate | Working | a2a-message.ts brain gate |

### What needs to be built

| Component | What | Why |
|-----------|------|-----|
| **Instruction templates** | Per-role instruction JSON in server config | So A2A server sends structured work, not flat text |
| **tmux instruction delivery** | A2A server types structured instructions into Claude terminal | Bridge between SSE event and Claude Code |
| **Result capture** | Claude sends TRANSITION + DNA via curl back to A2A | Agent reports completion via A2A protocol |
| **Instruction config file** | JSON/YAML file defining per-role instructions | Iterable without code changes |

---

## Part 6: Test Cases (from WORKFLOW.md)

Each transition from Part 2 is a test case. The test verifies: event sent → agent receives → agent works → agent transitions → gate validates → next event fires.

### TC-1: PDSA Happy Path (12 steps)

```
Precondition: No agents running. Task in pending+pdsa.

1. Spawn PDSA agent (+1 PDSA)
2. LIAISON transitions task: pending → ready
3. VERIFY: PDSA receives TASK_ASSIGNED with full DNA
4. PDSA claims: ready → active (gate: memory_query_session)
5. PDSA works: reads DNA, produces design
6. PDSA transitions: active → approval (gate: pdsa_ref + brain_contribution)
7. VERIFY: LIAISON receives APPROVAL_NEEDED
8. LIAISON approves: approval → approved (gate: human_answer)
9. Spawn QA agent (+1 QA)
10. VERIFY: QA receives TASK_ASSIGNED
11. QA writes tests, transitions: testing → ready+dev
12. Spawn DEV agent (+1 DEV)
13. VERIFY: DEV receives TASK_ASSIGNED
14. DEV implements, transitions: active → review
15. VERIFY: QA receives REVIEW_NEEDED
16. QA reviews → review+pdsa
17. PDSA reviews → review+liaison
18. LIAISON completes → complete (gate: abstract_ref + human_answer)
19. VERIFY: Cascade engine unblocks dependents
20. VERIFY: All DNA fields filled, all gates passed
```

### TC-2: Rework Path

```
Precondition: Task at review+liaison.

1. LIAISON rejects: review → rework (rework_target_role: dev)
2. VERIFY: DEV receives REWORK_NEEDED
3. DEV claims rework: rework → active
4. DEV fixes, transitions: active → review
5. Review chain resumes: qa → pdsa → liaison → complete
```

### TC-3: Blocked/Unblocked

```
Precondition: Task at active+dev, brain goes down.

1. DEV blocks: active → blocked (blocked_reason: "Brain unavailable")
2. VERIFY: LIAISON receives TASK_BLOCKED
3. Thomas fixes brain
4. LIAISON restores: blocked → active+dev (from_state + from_role restored)
5. DEV resumes work
```

### TC-4: Multiple Agents Same Role

```
Precondition: Two DEV agents connected.

1. Task transitions to ready+dev
2. VERIFY: Both DEV agents receive TASK_ASSIGNED
3. One claims first (ready → active)
4. VERIFY: Second agent does NOT also claim
5. First DEV works and transitions
```

---

## Part 7: Decision Trail

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | No Anthropic API | Max plan only. Claude Code CLI is the only inference path. |
| D2 | A2A server is LLM-less | Deterministic routing, fast, auditable. Process in server, work in agent. |
| D3 | Instructions in server config | Iterable. Change the template → all agents get new instructions. No agent restart. |
| D4 | Claude Code in tmux | Interactive terminal. User can see and interact. Max plan OAuth auth. |
| D5 | tmux send-keys for delivery | Proven working. Types instructions into Claude's prompt. |
| D6 | curl for result reporting | Agent sends TRANSITION + DNA back to A2A. Standard HTTP. |
| D7 | Workflow rules as twin (future) | Change the twin → change the workflow. No code deploy. Planned but not yet. |
| D8 | No monitor sidecar | Reintroduced polling. Claude should be the participant, not a black box. |
| D9 | Events not chat | Agents publish what happened, subscribers react. Decoupled. |
