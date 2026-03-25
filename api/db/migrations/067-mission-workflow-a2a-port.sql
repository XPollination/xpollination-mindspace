-- Mission: Workflow A2A Port — the living workflow
-- This is the LAST mission created via SQL migration.
-- After this mission is implemented, all object creation goes through A2A.

INSERT OR IGNORE INTO missions (id, title, description, status, short_id, content_md, content_version)
VALUES (
  'mission-workflow-a2a-port',
  'Workflow A2A Port',
  'Port the complete WORKFLOW.md v19 into A2A as the living workflow. Replace procedural workflow-engine.js with object-oriented twin state machines. A2A becomes the single write authority — no CLI bypass, no SQL data mutations, no direct DB access.',
  'active',
  lower(hex(randomblob(4))),
  '# Mission: Workflow A2A Port

## Vision

The A2A server becomes the **living workflow**. When an agent connects, the protocol tells it what to do. When it submits work, the protocol validates it. When it transitions, the protocol enforces every gate. The agent does not need to know the rules — the protocol embodies them.

Today, two systems manage workflow: `workflow-engine.js` (procedural whitelist, 448 lines) and `interface-cli.js` (CLI commands agents call). Both are bootstrap scaffolding. The workflow-engine.js was identified as an anti-pattern on 2026-03-16: "agents can change rules by checking out a different branch." The correct architecture: rules live server-side, agents interact only through protocol.

This mission retires `workflow-engine.js` and replaces it with **object-oriented twin state machines** where each twin type carries its own lifecycle rules. The A2A handler becomes thin — it loads the twin, delegates validation to the twin, persists if valid, broadcasts the change.

## Rationale

### Evidence: Agents Bypass Workflow

On 2026-03-25, two agents created missions by writing SQL migration files (066-mission-unternehmensstruktur.sql), committing them, and rebuilding the Docker container. This happened because OBJECT_CREATE returns 501 — agents fell back to the only path available.

On 2026-03-02, the LIAISON agent autonomously approved 4 PDSA designs without presenting to Thomas. The quality gates existed in workflow-engine.js but the agent used a different code path.

On 2026-03-25, the A2A TRANSITION handler was found to perform raw `UPDATE SET status` without using any workflow-engine.js validation. Every transition via the kanban UI or A2A bypasses all 19 versions of workflow rules.

**Pattern:** If the system does not PREVENT it, it WILL happen. The workflow-engine.js prevents nothing because it is a local file that agents can bypass.

### The Shift: Procedural → Object-Oriented

| Aspect | Old (Bootstrap) | New (Twin OO) |
|--------|----------------|---------------|
| Rules location | workflow-engine.js (local file) | Twin modules (server-side) |
| Validation | validateTransition() called by CLI | Twin.transition() called by A2A |
| Agent interface | node interface-cli.js | POST /a2a/message |
| Bypass risk | Agents can modify or skip CLI | A2A is the only write path |
| Context | Agent must know the rules | Protocol tells agent what to do |
| Audit | CLI logs (local) | task_transitions + SSE + brain |

### Why Fully New (Not Wrapping)

Thomas''s direction: "we do not need the workflow-engine.js anymore. it was important for bootstrapping but as we have iterated the kanban from procedural to object orientated, we do now a fully new implementation."

The workflow-engine.js ALLOWED_TRANSITIONS map served through 19 iterations of rule refinement. Those rules are preserved — they are re-encoded into twin state machines. But the architecture changes fundamentally: from "server checks a rules table" to "the object knows its own lifecycle."

## Capabilities Composed

### CAP-1: Twin State Machines

Each twin type gets a state machine encoded in its module:

**task-twin.js** — Full WORKFLOW.md v19 encoding:
- 11 states: pending, ready, active, approval, approved, testing, review, rework, complete, blocked, cancelled
- Each state defines: allowed transitions, actor permissions, DNA requirements, role assignments, DNA clears
- `transitionTask(twin, toStatus, actor, dna)` → validates and returns new state or error
- `workflowContext(twin)` → returns allowed transitions, missing DNA, agent prompts

**mission-twin.js** — 5-state lifecycle:
- draft → ready → active → complete + deprecated
- `transitionMission(twin, toStatus)` → validates

**capability-twin.js** — 5-state lifecycle:
- draft → active → blocked → complete → cancelled

**requirement-twin.js** — 2-state:
- draft → active

### CAP-2: OBJECT_CREATE Handler

Replace 501 stub in `api/routes/a2a-message.ts`:

```
Agent → OBJECT_CREATE { object_type, payload }
A2A:
  1. Twin.create(payload)       — construct twin from payload
  2. Twin.validate()            — check interface compliance
  3. Generate ID + short_id     — UUID + 8 hex chars
  4. Persist to DB              — INSERT into correct table
  5. Broadcast via SSE          — object_created event
  6. Return twin + workflow_context
```

Supported types: mission, capability, requirement, task

Task creation rules:
- Initial status: pending (always)
- Actor permission: only pdsa, liaison, system can create tasks
- DNA must include: title, role, description
- Type must be: task or bug

### CAP-3: OBJECT_UPDATE Handler

Replace 501 stub:

```
Agent → OBJECT_UPDATE { object_type, object_id, updates }
A2A:
  1. Load existing from DB      — find by id, slug, or short_id
  2. Apply updates              — merge into twin
  3. Twin.validate()            — re-validate after changes
  4. DNA field validators       — pdsa_ref must be GitHub URL, etc.
  5. Twin.diff(old, new)        — compute changes
  6. Persist changes            — UPDATE correct table
  7. Broadcast via SSE          — object_updated event
  8. Return updated twin + diff + workflow_context
```

Constraints:
- Complete tasks are immutable (reject with "create child task")
- human_confirmed cannot be set via A2A (viz-only field)
- DNA field validators from interface-cli.js re-encoded here

### CAP-4: TRANSITION Rewrite

Replace the current raw UPDATE handler with twin-delegated validation:

```
Agent → TRANSITION { task_slug, to_status, actor, payload }
A2A:
  1. Load twin from DB
  2. Twin.transition(toStatus, actor, dna)  — validates everything
  3. If error → return ERROR with reason
  4. Apply DNA updates from payload
  5. Apply DNA clears (rework cleanup)
  6. Set new role per state machine
  7. Handle blocked→restore (read from_state/from_role from DNA)
  8. Persist atomically
  9. Record in task_transitions
  10. Broadcast via SSE
  11. Contribute to brain on significant transitions
  12. Return ACK + workflow_context (what agent should do next)
```

Quality gates (from WORKFLOW.md v19, all enforced by twin):
- DNA requirements per transition
- pdsa_ref/abstract_ref must be GitHub URLs
- Test pass gate: test_pass_count === test_total_count
- PR merge gate: pr_url + verdict + reasoning + sha
- Liaison review gate: 3 challenge questions, min 20 chars
- Human answer audit trail: human_answer + human_answer_at + approval_mode
- Role consistency: fixed-role states (complete→liaison, approval→liaison, etc.)
- Version enforcement: first submission v0.0.1, rework v0.0.2+

### CAP-5: Workflow Context

Every A2A response for tasks includes `workflow_context`:

```json
{
  "workflow_context": {
    "current_state": "active",
    "current_role": "pdsa",
    "state_label": "PDSA Design Active",
    "allowed_transitions": [
      {
        "to_status": "approval",
        "label": "Submit Design for Approval",
        "required_dna": ["pdsa_ref", "memory_contribution_id"],
        "missing_dna": ["pdsa_ref"],
        "ready": false,
        "prompt": "Write your PDSA doc, commit to git, set pdsa_ref."
      }
    ],
    "quality_gates_ahead": [
      "pdsa_ref must be a GitHub URL",
      "memory_contribution_id must be set"
    ]
  }
}
```

This is what makes A2A the living workflow. Agents don''t need to read WORKFLOW.md — the protocol tells them what to deliver.

### CAP-6: Bypass Prevention

Four layers of enforcement after gate closure:

**Layer 1 — Protocol Gate:** All writes go through POST /a2a/message. No other write endpoint exists.

**Layer 2 — Twin Validation:** Every CREATE/UPDATE/TRANSITION delegates to twin module. Invalid operations rejected.

**Layer 3 — Persistence:** Only the A2A handler writes to DB. CLI becomes read-only diagnostic.

**Layer 4 — Audit:** task_transitions log, SSE broadcast, brain contribution. Every change is visible.

Specific bypass paths blocked:
1. **CLI writes** — interface-cli.js create/transition/update-dna commands removed
2. **SQL data migrations** — migrations become schema-only (ALTER TABLE, CREATE INDEX)
3. **Direct DB access** — agents don''t have sqlite3 write access to prod data
4. **REST write routes** — task/mission REST routes become read-only or redirect through A2A
5. **Agent checkout** — rules live server-side in twin modules, not in agent-accessible files

### CAP-7: Browser A2A Client Update

`viz/.../js/a2a-client.js` gets new methods:

```javascript
// Create a new object via A2A
async create(objectType, payload) {
  return this.send({ type: ''OBJECT_CREATE'', object_type: objectType, payload });
}

// Update an existing object
async update(objectType, objectId, updates) {
  return this.send({ type: ''OBJECT_UPDATE'', object_type: objectType, object_id: objectId, updates });
}
```

Kanban and mission board use these instead of (currently non-existent) direct manipulation.

## Current State

### What Works via A2A
- OBJECT_QUERY: missions, capabilities, requirements, tasks with filters
- TRANSITION (raw): status updates without workflow validation
- SSE broadcast: real-time updates to connected clients
- HEARTBEAT, ROLE_SWITCH, DISCONNECT: agent lifecycle

### What Does NOT Work
- OBJECT_CREATE: returns 501 (stub)
- OBJECT_UPDATE: returns 501 (stub)
- TRANSITION validation: skips ALL quality gates
- Workflow context: not included in any response
- Agent prompts: agents must know the rules themselves

### Bootstrap Paradox
To build A2A, we must temporarily bypass A2A. This mission itself was created via SQL migration (067) — the **last** data mutation via SQL. Once OBJECT_CREATE works, all future objects go through A2A.

## Evidence

- `api/routes/a2a-message.ts` lines 429-434: OBJECT_CREATE and OBJECT_UPDATE are `handleStub` → 501
- `api/routes/a2a-message.ts` lines 320-427: TRANSITION handler does raw UPDATE without workflow-engine.js
- `api/db/migrations/066-mission-unternehmensstruktur.sql`: agent created mission via SQL migration
- `src/db/workflow-engine.js`: 448 lines of procedural rules that A2A completely ignores
- Brain thought `91c8416a`: "workflow-engine.js as a local file is an anti-pattern for multi-agent systems"
- Brain thought `caf654ae`: "A2A is LLM-less — executes mechanically, cannot reason into shortcuts"

## Implementation Sequence

### Step 1: Twin State Machines
**Files:** `src/twins/task-twin.js`, `src/twins/mission-twin.js`
**What:** Add `transitionTask()` and `workflowContext()` to task-twin.js. Encode WORKFLOW.md v19 rules as OO state machine in the twin. Add `transitionMission()` to mission-twin.js.
**Verification:** Unit tests — valid transitions pass, invalid transitions rejected, DNA requirements enforced.

### Step 2: OBJECT_CREATE Handler
**Files:** `api/routes/a2a-message.ts`
**What:** Replace `handleStub` for OBJECT_CREATE. Validate twin, generate IDs, persist, broadcast, return with workflow_context.
**Verification:** Create mission, capability, requirement, task via A2A. Verify in DB and viz.

### Step 3: OBJECT_UPDATE Handler
**Files:** `api/routes/a2a-message.ts`
**What:** Replace `handleStub` for OBJECT_UPDATE. Load existing, apply changes, validate, diff, persist, broadcast.
**Verification:** Update task DNA via A2A. Verify immutability gate for complete tasks.

### Step 4: TRANSITION Rewrite
**Files:** `api/routes/a2a-message.ts`
**What:** Replace current raw UPDATE with twin-delegated validation. Call `transitionTask()` instead of direct SQL.
**Verification:** Attempt invalid transitions → rejected. Valid transitions → gates enforced. Review chain works.

### Step 5: Workflow Context
**Files:** `api/routes/a2a-message.ts`, `src/twins/task-twin.js`
**What:** Include `workflow_context` in OBJECT_QUERY, OBJECT_UPDATE, and TRANSITION responses.
**Verification:** Query a task → response includes allowed transitions and prompts.

### Step 6: Browser Client Update
**Files:** `viz/.../js/a2a-client.js`
**What:** Add `create()` and `update()` methods. Update kanban to use them.
**Verification:** Create task from viz UI via A2A. Update task DNA from viz.

### Step 7: CLI Read-Only
**Files:** `src/db/interface-cli.js`
**What:** Remove `create`, `transition`, `update-dna` commands. Keep `get`, `list`, `capability-status`.
**Verification:** CLI write commands return error message pointing to A2A.

### Step 8: Agent Skills Update
**Files:** Agent monitor script, xpo.claude.monitor skill
**What:** Agents use A2A client (curl POST /a2a/message) instead of node interface-cli.js.
**Verification:** Agent claims task, does work, transitions — all via A2A.

### Step 9: Gate Closure Verification
**What:** Full lifecycle acceptance test via A2A. No CLI, no SQL, no direct DB access.
**Verification:**
- Create task via A2A → pending
- Transition to ready → PDSA assigned
- PDSA claims → memory_query_session required
- PDSA submits → pdsa_ref (GitHub URL) required
- Human approves → audit trail required
- QA tests → ready for dev
- Dev implements → review chain
- Review chain: qa → pdsa → liaison → complete
- Rework paths work
- Blocked/restore works
- Invalid transitions rejected at every step

## Gaps

- **Attestation gate integration:** workflow-engine.js exports `checkAttestationGate` — needs equivalent in twin transition
- **Brain integration in A2A:** Current CLI contributes to brain on transitions. A2A must do the same.
- **Human confirmation via viz:** Approval modes (auto/semi/manual) need viz buttons that set human_confirmed in DNA. This is a viz capability, not an A2A capability.
- **Dependency gate:** pending→ready checks that all depends_on tasks are complete. Twin must implement this.
- **Version enforcement gate:** First submission requires v0.0.1 in pdsa_ref, rework requires v0.0.2+.

## Decision Trail

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-16 | workflow-engine.js identified as anti-pattern | Agents can change rules by switching branches |
| 2026-03-24 | Twin protocol is the unifying layer | All capabilities were heading toward self-describing objects |
| 2026-03-25 | workflow-engine.js RETIRED | Bootstrap served its purpose. OO twin state machines replace it. |
| 2026-03-25 | I implement alone (no team delegation) | Critical path — cannot create tasks for agents when task creation itself is what we are building |
| 2026-03-25 | Last SQL data migration: 067 | After this, all object creation goes through A2A |
| 2026-03-25 | Phase 0/1/2 bootstrap sequence | Acknowledged paradox — must bypass A2A to build A2A, then close the bypass |

## Changelog

### v1 (2026-03-25)
- Initial mission with full implementation plan
- 5 SVG diagrams: twin lifecycle, task state machine, enforcement architecture, agent interaction loop, bootstrap sequence
- 9-step implementation sequence identified
- Bootstrap paradox documented and resolved with 3-phase approach

## Diagrams

![Twin Lifecycle](docs/diagrams/workflow-a2a-port/01-twin-lifecycle.svg)
![Task State Machine](docs/diagrams/workflow-a2a-port/02-task-state-machine.svg)
![Enforcement Architecture](docs/diagrams/workflow-a2a-port/03-enforcement-architecture.svg)
![Agent Interaction Loop](docs/diagrams/workflow-a2a-port/04-agent-interaction-loop.svg)
![Bootstrap Sequence](docs/diagrams/workflow-a2a-port/05-bootstrap-sequence.svg)
',
  1
);
