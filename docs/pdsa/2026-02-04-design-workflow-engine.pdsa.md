# PDSA: Automated Workflow Engine Design

**Date:** 2026-02-04
**Node:** design-workflow-engine (910b3601-b5d0-429c-97fb-054c868dec32)
**Type:** Design
**Status:** ACTIVE

## PLAN

### Problem Statement

LIAISON currently acts as a manual workflow engine:
- Polls task statuses every 10s
- Routes tasks between agents (PDSA → Thomas review → Dev → QA)
- Transitions statuses manually
- Fixes issues (status spelling, missing fields)
- Reports progress to Thomas

This manual process is BY DESIGN to learn what an automated workflow engine needs.

### Critical Gap Identified

Current "review" status is ambiguous:
1. PDSA design awaiting HUMAN approval (before dev starts)
2. Dev implementation awaiting QA verification (after dev finishes)

These are different quality gates with different actors.

### Goals

- AC1: Document current manual workflow patterns observed
- AC2: Propose status enhancement for design approval gate
- AC3: Define complete state machine with type-aware rules
- AC4: Specify actor permissions for each transition
- AC5: Design human notification mechanism for approval gates
- AC6: Propose workflow engine architecture
- AC7: Thomas reviews and approves before implementation
- AC-NEW: Workflow engine automatically transitions role when phase changes
- AC-NEW: Define single-storyline model (phase-based OR parent-child)
- AC-NEW: Enforce claim step (only target role can set ready→active)

---

## DO (Findings)

### AC1: Current Manual Workflow Patterns

**Observed flow:** LIAISON polls → finds status change → routes to next actor → monitors → reports

**Manual tasks:**
- Status transition
- Routing between agents
- Spelling/field fixes
- Progress reports

**Pain points:**
- High token usage for polling
- Manual error correction
- No human notification mechanism

### AC2: Approval Gate Recommendation

**New status:** `approval`

**Rationale:** Distinguish human design approval from QA technical review

**Usage:** Design nodes go:
```
pending → ready → active → approval (wait for Thomas) → complete
```
Then dev task created.

### AC3: Complete State Machine

**Statuses:**
- `pending` - Not yet released
- `ready` - Available for claiming
- `active` - Being worked on
- `approval` - Awaiting human approval (design only)
- `review` - Awaiting QA review (task only)
- `rework` - Needs revision
- `complete` - Done
- `blocked` - Cannot proceed
- `cancelled` - Abandoned

**Transitions by type:**

| Type | Transition | Actor | Description |
|------|------------|-------|-------------|
| design | pending→ready | LIAISON | Release for PDSA |
| design | ready→active | PDSA | PDSA claims |
| design | active→approval | PDSA | PDSA submits design |
| design | approval→complete | Thomas | Thomas approves |
| design | approval→rework | Thomas | Thomas requests changes |
| design | rework→active | PDSA | PDSA revises |
| task | pending→ready | PDSA/LIAISON | Release for dev |
| task | ready→active | Dev | Dev claims |
| task | active→review | Dev | Dev submits implementation |
| task | review→complete | QA | QA approves |
| task | review→rework | QA | QA requests changes |
| task | rework→active | Dev | Dev revises |

### AC4: Actor Permission Matrix

| Actor | Allowed Transitions |
|-------|---------------------|
| liaison | pending→ready, any→cancelled, any→blocked |
| thomas | approval→complete, approval→rework |
| pdsa | ready→active (type=design), active→approval, review→complete, review→rework |
| dev | ready→active (type=task), active→review |
| system | automatic notifications, timeout escalations |

### AC5: Human Notification Mechanism

**Mechanism:** Write to `/tmp/human-notification.json` on approval status

**Content:**
```json
{
  "node_id": "...",
  "title": "...",
  "requires": "Thomas approval",
  "link": "viz URL"
}
```

**Future:** Email/Slack webhook when available

### AC6: Workflow Engine Architecture

**Components:**
1. **TransitionValidator** - validates status changes against rules
2. **ActorAuthorizer** - checks permission for actor+transition
3. **NotificationService** - triggers on status changes
4. **WorkflowPoller** - replaces manual LIAISON polling

**Location:** `src/workflow/`

**Integration:** `pm_transition` tool calls TransitionValidator before db write

### LIAISON Feedback Items

#### Feedback 1: Role Not Updated During Phase Transitions
- Task req-regulated-database-access completed by PDSA (role: pdsa)
- When released for development, role remained pdsa instead of dev
- Dev agent monitor looks for role:dev tasks - did not pick it up
- **Requirement:** Workflow engine must handle role transitions when tasks move between phases

#### Feedback 2: Type Morphing Creates Chaos
- Current: feature-self-contained-dna (req) + design-self-contained-dna (design) = 2 unlinked nodes
- **Problem:** Work fragments into many items instead of ONE story with phases

**Models to consider:**
| Model | Description | Pros | Cons |
|-------|-------------|------|------|
| Phase Model | Single node, status reflects phase | Simple, clear storyline, DNA accumulates | Large objects |
| Parent-Child | Epic/Story parent, subtasks as children | Clear lineage, parallelizable | More complex |

#### Feedback 3: Claim Step Bypassed
- LIAISON set task to active instead of ready - bypassed claim step
- **Correct flow:** LIAISON releases → ready → Dev claims → active
- **Requirement:** Only target agent can transition ready→active

#### Feedback 4: Bypass PDSA Workflow Valid
- Example: migrate-to-database-interface went direct from parent complete → child task → ready for dev
- **Rule:** Full PDSA for new features, architectural decisions. Bypass OK for follow-up tasks, migrations, bug fixes where solution is known.

---

## STUDY

### Research Answers

| Question | Answer |
|----------|--------|
| approval as status or flag? | New status - cleaner than flag |
| Distinguish human vs automated gates? | Type-aware rules (design=human, task=QA) |
| Supported triggers? | Status change, timeout, parent completion |
| Rejection handling? | Goes to rework status, then back to active |
| Configurable rules? | Start hardcoded, config later if needed |

### Validation

All 6 original ACs + 3 new ACs from LIAISON feedback documented.

---

## ACT

### Implementation Tasks (in order)

1. **TransitionValidator** - enforce type-aware transition rules
2. **ActorAuthorizer** - verify actor can perform transition
3. **Role auto-update** - change role when phase changes
4. **Claim enforcement** - only target agent can claim
5. **NotificationService** - human notification on approval
6. **Integration** - connect to interface-cli.js

### Pending Decision

**Single storyline model:** Phase-based vs Parent-child needs Thomas decision.

Recommendation: **Phase model** fits Cell/DNA vision better - one cell accumulates all work in its DNA.

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-design-workflow-engine.pdsa.md
