# Workflow Reference - Source of Truth

**Last Updated:** 2026-03-12
**Status:** DRAFT v19 - Human answer audit trail gate

---

## PDSA Design Path

| State | Actor (transitions TO) | Monitor (owns state) |
|-------|------------------------|----------------------|
| pending | system/liaison | - |
| ready | liaison | pdsa |
| active | pdsa | pdsa |
| approval | pdsa | liaison |
| approved | human | qa |
| active | qa | qa |
| testing | qa | qa |
| ready | qa | dev |
| active | dev | dev |
| review | dev | qa |
| review | qa | pdsa |
| review | pdsa | liaison |
| complete | human | liaison |

**Notes:**
- `review` appears three times with different monitors:
  1. `review + qa` = QA reviews dev implementation
  2. `review + pdsa` = PDSA verifies design match
  3. `review + liaison` = Liaison presents to human for final approval
- `active + qa` enables rework re-entry: `rework+qa → active+qa → testing`

**Review chain transitions (same-state with role change):**
```
review+qa → review+pdsa     (actor: qa, changes role to pdsa)
review+pdsa → review+liaison (actor: pdsa, changes role to liaison)
review+liaison → complete    (actor: human/liaison, final approval)
```
These are `review → review` transitions where the role changes. The workflow engine must support same-state transitions with role updates.

---

## Rework Entry Points

| State | Actor (transitions TO) | Monitor (owns state) | Reason |
|-------|------------------------|----------------------|--------|
| rework | liaison | pdsa | liaison catches issue (autonomous) |
| rework | human | pdsa | human rejects design (from approval) |
| rework | qa | dev | QA finds test issues (from review+qa) |
| rework | pdsa | dev | PDSA finds design mismatch (from review+pdsa) |
| rework | human | qa | human reopens to update tests first |
| rework | human | dev | human reopens completed PDSA task |
| rework | human | liaison | human rejects or reopens liaison content |

### Rework Target Role (Engine Routing Rule)

When LIAISON/human reworks from `review+liaison`, the engine must route to the correct role. The rework target depends on **what needs fixing**:

| What needs fixing | Target role | DNA signal |
|-------------------|-------------|------------|
| Implementation | dev | `rework_target_role: "dev"` |
| Design | pdsa | `rework_target_role: "pdsa"` |
| Tests | qa | `rework_target_role: "qa"` |
| Liaison content | liaison | `rework_target_role: "liaison"` |

**Rule:** When transitioning `review+liaison → rework`, `dna.rework_target_role` MUST be set. The engine reads this field to assign the correct role. If not set, the engine MUST reject the transition (no guessing).

This also applies to `complete → rework` (human reopens) and `approval → rework` (human rejects design, always routes to pdsa).

**Rework exit:** `rework → active` - assigned role reclaims, then normal flow continues.

**Rework re-entry points:** The role assigned to rework determines where the task re-enters the normal flow. No duplication needed - downstream transitions are reused.

```
rework+pdsa → active+pdsa → approval → approved → testing → ready+dev → active+dev → reviews → complete
              ↑ FULL flow from PDSA forward

rework+qa → active+qa → testing → ready+dev → active+dev → reviews → complete
            ↑ Flow from QA forward (skips design phase)

rework+dev → active+dev → review+qa → review+pdsa → review+liaison → complete
             ↑ Flow from DEV forward (skips design and tests)

rework+liaison → active+liaison → review+liaison → complete
                 ↑ Flow from LIAISON forward
```

**Reopening completed tasks:** Only human can transition `complete → rework`. The monitor role determines the re-entry point:
- `rework+qa` = tests need updating first
- `rework+dev` = implementation needs fixing
- `rework+pdsa` = design needs revision

---

## Liaison Content Path

| State | Actor (transitions TO) | Monitor (owns state) |
|-------|------------------------|----------------------|
| pending | system/liaison | - |
| ready | liaison | liaison |
| active | liaison | liaison |
| review | liaison | liaison |
| complete | human | liaison |

**Note:** At `review`, liaison presents to human. Human decides complete or rework.

---

## Blocked State (Meta-State)

Blocked is a **PAUSE**, not a rework. Tasks resume at the **exact** previous state+role when unblocked.

### Entry: Any State → Blocked

| Who Can Block | When | Required DNA |
|--------------|------|-------------|
| Any agent (pdsa, dev, qa, liaison) | Infrastructure failure (brain API down, DB locked, external dependency) | `blocked_reason` |
| system | Automated health check failure | `blocked_reason` |

**On transition to blocked, DNA stores:**
- `blocked_from_state` — the status before blocking (e.g., `review`)
- `blocked_from_role` — the role before blocking (e.g., `pdsa`)
- `blocked_reason` — why the task was blocked (e.g., `Brain API unavailable`)
- `blocked_at` — timestamp of when blocking occurred

### Exit: Blocked → Restore (Previous State+Role)

| Who Can Unblock | How |
|----------------|-----|
| liaison | After infrastructure is fixed, presents to Thomas, then executes restore |
| system | Automated recovery after health check passes |

**On restore, the engine:**
1. Reads `blocked_from_state` and `blocked_from_role` from DNA
2. Sets status to `blocked_from_state` (NOT to `active`)
3. Sets role to `blocked_from_role`
4. Clears `blocked_from_state`, `blocked_from_role`, `blocked_reason`, `blocked_at` from DNA

### Examples

| Before Block | Blocked State | After Unblock |
|-------------|--------------|---------------|
| `review+pdsa` | `blocked` (from_state=review, from_role=pdsa) | `review+pdsa` |
| `active+dev` | `blocked` (from_state=active, from_role=dev) | `active+dev` |
| `testing+qa` | `blocked` (from_state=testing, from_role=qa) | `testing+qa` |
| `approval+liaison` | `blocked` (from_state=approval, from_role=liaison) | `approval+liaison` |

### Key Difference from Rework

- **Rework** = "your work needs fixing" → re-enters workflow at defined entry point, may change role
- **Blocked** = "external failure, pause here" → resumes at exact same point, preserves role

### Brain-Down Escalation Chain

When brain API is unavailable and brain-gated transitions fail:
1. `cmdTransition()` returns error: "Brain unavailable"
2. Agent sets DNA: `{ blocked_reason: "Brain API unavailable" }`
3. Agent transitions to `blocked` (stores from_state + from_role)
4. Monitor surfaces blocked task with reason
5. LIAISON presents blocked task to Thomas
6. Thomas fixes brain infrastructure
7. LIAISON transitions `blocked → restore` (restores exact previous state+role)
8. Agent resumes exactly where it was

---

## Visualization Categories

States grouped for display:

| VIZ Category | States | Description |
|--------------|--------|-------------|
| QUEUE | pending, ready, rework | Waiting to be claimed |
| ACTIVE | active, testing | Work in progress |
| REVIEW | review, approval | Being reviewed/approved |
| APPROVED | approved | Human approved, awaiting next step |
| COMPLETE | complete | Done |
| BLOCKED | blocked, cancelled | Stopped |

---

## Quality Gates

Certain transitions require DNA fields to be present before the transition is allowed. The workflow engine enforces these as hard gates.

| Transition | Required DNA | Validation | Who Writes |
|------------|-------------|------------|------------|
| `active->approval` | `pdsa_ref`, `memory_contribution_id` | `pdsa_ref` must be GitHub URL | PDSA |
| `approval->complete` | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
| `review->complete` | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
| `any->cancelled` (liaison) | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
| `any->cancelled` (system) | _(none)_ | System exempted from abstract gate | System |
| `any->blocked` | `blocked_reason` | Must be non-empty | Any agent |
| `ready->active` | `memory_query_session` | Must be non-empty | Claiming agent |
| **requiresHumanConfirm (liaison)** | **`human_answer`, `human_answer_at`, `approval_mode`** | **See Human Answer Gate below** | **LIAISON** |

### Human Answer Audit Trail Gate (v19)

When LIAISON executes any `requiresHumanConfirm` transition, the engine requires three mandatory DNA fields as an audit trail of the human decision. This applies in **ALL approval modes** (auto, semi, auto-approval, manual).

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `human_answer` | string | Exact text of human decision | `"Approve (Recommended)"`, `"AUTO-APPROVE: Design is solid"`, `"Rework"` |
| `human_answer_at` | string | ISO 8601 timestamp of when human answered | `"2026-03-12T15:00:00Z"` |
| `approval_mode` | enum | Active approval mode at decision time | `"autonomous"`, `"semi"`, `"auto-approval"`, `"manual"` |

**Valid `approval_mode` values:** `manual`, `semi`, `auto-approval`, `autonomous`

**Affected transitions (all `requiresHumanConfirm` transitions):**
- `approval → approved`
- `approval → complete`
- `approval → rework`
- `review+liaison → complete`
- `review+liaison → rework`

**Mode-specific behavior:**
- **Auto:** LIAISON sets `human_answer` with `AUTO-APPROVE:` prefix, sets own timestamp
- **Semi:** LIAISON records Thomas's typed response verbatim
- **Manual:** Viz UI sets fields on button click
- **Auto-Approval:** Same as auto for approval-direction, Thomas for completion

**Key difference from viz confirmation gate (v18):**
- `human_confirmed` + `human_confirmed_via=viz` = engine enforcement for specific modes (cleared after use)
- `human_answer` + `human_answer_at` + `approval_mode` = permanent audit trail for ALL modes (never cleared)

**Incident context:** On 2026-03-02, LIAISON autonomously approved 4 PDSA designs without presenting to Thomas. On 2026-03-12, `mindspace-api-deployment` was approved in semi mode but only `liaison_reasoning` was recorded — Thomas's actual answer was lost. This gate ensures every human-decision transition has a complete audit trail.

### Role Consistency Enforcement (v17)

Fixed-role states have a mandatory role assignment. The engine REJECTS any transition that would produce the wrong role:

| State | Required Role | Rationale |
|-------|--------------|-----------|
| complete | liaison | Liaison monitors completed tasks |
| approval | liaison | Liaison presents designs to human |
| approved | qa | QA writes tests for approved designs |
| testing | qa | QA owns the testing phase |
| cancelled | liaison | Liaison monitors cancelled tasks |

Variable-role states (active, review, ready, rework, pending, blocked) are NOT checked — their role depends on the workflow path.

### Completion Documentation Gate (v14)

When a task reaches `complete` or `cancelled`, a completion abstract must exist in git and be linked via `abstract_ref` in DNA. This ensures every completed task has a documented outcome.

- **Location:** `tracks/<domain>/<task-slug>/v0.0.1/abstract/YYYY-MM-DD-<slug>.abstract.md`
- **Content:** Management summary of outcome, changes, decisions, and learnings
- **Gate:** `abstract_ref` must be a GitHub URL (hard gate on `review->complete` and liaison `any->cancelled`)
- **Exemption:** System-initiated cancellations (`any->cancelled:system`) do not require an abstract
- **Format:** See `tracks/process/context/DOCUMENTATION.md` for template and conventions

---

## Liaison Approval Modes (v18)

Liaison executes human-decision transitions on behalf of Thomas. The **approval mode** controls which transitions require a hard engine gate (`human_confirmed` + `human_confirmed_via=viz`) vs which liaison can execute freely.

The mode is stored in `system_settings` as `liaison_approval_mode`. Thomas changes it via the mindspace viz dropdown. The engine checks the mode on every human-decision transition.

### Mode Definitions

**Autonomous** — No engine enforcement. Liaison executes all human-decision transitions freely, takes full responsibility, drives without human wait. Use only when Thomas is actively monitoring agent output in real-time.

**Auto-Approval** — Approval transitions are free, completion transitions require viz confirmation. This is the standard operating mode: Thomas trusts the pipeline to move work forward but always signs off on final completion.

**Semi** — No engine enforcement. Liaison must follow protocol: present task details and wait for Thomas to type his decision before executing. Enforcement is protocol-only (agent behavior, not engine gate). Use when Thomas wants to see every decision but doesn't want to click viz buttons.

**Manual** — All human-decision transitions require `human_confirmed=true` with `human_confirmed_via=viz`. Thomas must click the corresponding button in mindspace viz for every transition. Maximum control.

### Transition Enforcement Matrix

This table is the **source of truth** for how the engine gates each human-decision transition per mode.

| Transition | Autonomous | Auto-Approval | Semi | Manual |
|------------|------|---------------|------|--------|
| `approval → approved` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `approval → complete` | free | `human_confirmed` + `via=viz` | protocol only | `human_confirmed` + `via=viz` |
| `approval → rework` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `review+liaison → complete` | free | `human_confirmed` + `via=viz` | protocol only | `human_confirmed` + `via=viz` |
| `review+liaison → rework` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `complete → rework` | protocol only | protocol only | protocol only | protocol only |

**All transitions above also require `human_answer` + `human_answer_at` + `approval_mode` (v19 audit trail gate).**

**Legend:**
- **free** = engine allows the transition without any human confirmation gate
- **`human_confirmed` + `via=viz`** = engine requires `dna.human_confirmed=true` AND `dna.human_confirmed_via=viz`. Only the mindspace viz UI can set these fields. Liaison agents cannot set `human_confirmed` via CLI (enforced by update-dna command)
- **protocol only** = engine does not enforce a gate. Enforcement relies on agent protocol (liaison presents and waits for Thomas). No viz button exists for this transition

### Design Principles

1. **Completion is always gated in auto-approval.** Any transition to `complete` requires Thomas to click in viz. Completing a task is terminal — it closes the work item. Thomas must always sign off.

2. **Approval-direction transitions are free in auto-approval.** Moving work forward (`approval → approved`) or backward (`approval → rework`, `review+liaison → rework`) through the pipeline is trusted. These redirect work, they don't close it.

3. **Protocol-only is unreliable.** Semi mode and `complete → rework` rely on agent protocol — the agent must present and wait. This has failed repeatedly (2026-03-02 incident: 4 tasks auto-completed, 2026-03-12 incident: 4 more tasks auto-completed). Protocol-only gates should be replaced with engine gates when viz buttons become available.

4. **`complete → rework` has no viz button.** Reopening completed tasks is rare and has no UI element. It remains protocol-only across all modes until a viz button is added.

5. **Human answer audit trail is always required (v19).** Regardless of approval mode, every human-decision transition must record the human's actual answer. This prevents the class of error where LIAISON reasoning is recorded but the human decision text is lost.

### Viz Button Requirements

For hard gates to work, the mindspace viz must show action buttons on task cards:

| Button | Shows on | Sets in DNA |
|--------|----------|-------------|
| **Approve** | `approval+liaison` cards | `human_confirmed=true`, `human_confirmed_via=viz` |
| **Complete** | `approval+liaison` cards (research tasks), `review+liaison` cards | `human_confirmed=true`, `human_confirmed_via=viz` |
| **Rework** | `approval+liaison` cards (manual mode only) | `human_confirmed=true`, `human_confirmed_via=viz` |

The **Complete** button on `review+liaison` cards is the critical missing element. Without it, auto-approval mode cannot enforce the completion gate.

---

## Key Rules

1. **Actor** = who performs the transition
2. **Monitor** = who watches for tasks in this state (their work queue)
3. **State + Monitor** = defines the context (e.g., review+qa vs review+pdsa)
4. **Rework re-entry** = same role that originally owned the work claims it back
5. **Human = Liaison proxy** = When "human" appears as actor, the decision is made by Thomas but **liaison executes the transition**. Liaison is the only agent authorized to perform human-decision transitions.

---

## Human-Decision Transitions (Liaison Executes)

These transitions require human (Thomas) decision but are executed by liaison:

| Transition | Context | Required DNA (v19) |
|------------|---------|-------------------|
| approval → approved | Human approves PDSA design (routes to QA for testing) | `human_answer`, `human_answer_at`, `approval_mode` |
| approval → complete | Human approves research task that produced sub-tasks (no QA needed) | `human_answer`, `human_answer_at`, `approval_mode` |
| approval → rework | Human rejects PDSA design | `human_answer`, `human_answer_at`, `approval_mode` |
| review+liaison → complete | Human approves final result | `human_answer`, `human_answer_at`, `approval_mode` |
| review+liaison → rework | Human rejects final result | `human_answer`, `human_answer_at`, `approval_mode` |
| complete → rework | Human reopens completed task | _(protocol only, no engine gate)_ |

**Security implication:** In the agent key system, these transitions are allowed for `actor=liaison`. There is no separate "human" key - liaison's key grants authority to execute human decisions.

**Enforcement:** The level of engine enforcement per transition depends on the active approval mode. See [Liaison Approval Modes](#liaison-approval-modes-v18) for the enforcement matrix. The human answer audit trail gate (v19) applies to ALL modes on top of the mode-specific gates.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-06 | v1 Initial draft | Liaison |
| 2026-02-06 | v2 Added human gate, rework paths | Liaison |
| 2026-02-06 | v3 Rolled back pdsa-review state, clarified state+monitor concept | Liaison |
| 2026-02-06 | v4 Added final human gate: review+liaison before complete (human approves) | Liaison |
| 2026-02-06 | v5 Added reopen flow: complete→rework (human only, routes to last implementer) | Liaison |
| 2026-02-06 | v6 Documented human=liaison proxy pattern for security key system | Liaison |
| 2026-02-06 | v7 Fixed rework actor: human→pdsa (was liaison→pdsa), expanded human-decision table | Liaison |
| 2026-02-06 | v8 Added both liaison autonomous AND human decision paths to pdsa rework | Liaison |
| 2026-02-06 | v9 Added human→qa rework path for updating tests before dev | Liaison |
| 2026-02-06 | v10 Documented rework re-entry points - role determines flow entry, no duplication | Liaison |
| 2026-02-06 | v11 Added active+qa state for rework re-entry (active→testing transition) | Liaison |
| 2026-02-06 | v12 Documented review→review transitions with role change (review chain) | Liaison |
| 2026-02-26 | v13 Added Blocked State meta-state: PAUSE+RESUME semantics, stores from_state/from_role in DNA, any agent can block, liaison/system restores, brain-down escalation chain | PDSA |
| 2026-03-02 | v14 Added completion documentation gate: abstract_ref required on review->complete and liaison any->cancelled. Quality Gates table. System exempted from abstract gate via split transition. DOCUMENTATION.md living doc created | DEV |
| 2026-03-02 | v15 Added approval→complete transition for research tasks. LIAISON can complete directly from approval when task produced sub-tasks and has no code to test. Requires abstract_ref + human confirmation. Bug type excluded (no approval state in bug flow) | DEV |
| 2026-03-06 | v16 Explicit rework target role routing: review+liaison→rework and complete→rework require dna.rework_target_role (dev/pdsa/qa/liaison). Engine must not guess — reject if missing. Fixes bug where binary pdsa_ref check routed to rework+liaison instead of rework+dev | Liaison |
| 2026-03-10 | v17 Role consistency enforcement: engine REJECTS transitions producing wrong role for fixed-role states (complete→liaison, approval→liaison, approved→qa, testing→qa, cancelled→liaison). EXPECTED_ROLES_BY_STATE map + validateRoleConsistency() gate. One-time migration fixes 69 historical complete tasks. Tracks structure reconciled between main and develop | DEV |
| 2026-03-12 | v18 Liaison approval modes: documented 4 modes (auto, auto-approval, semi, manual) with transition enforcement matrix. Key change: auto-approval gates completion transitions (`→ complete`) with `human_confirmed` + `via=viz`, keeps approval-direction transitions free. Protocol-only enforcement documented as unreliable (2 incidents). Viz button requirements specified. `complete → rework` remains protocol-only (no viz button) | Liaison |
| 2026-03-12 | v19 Human answer audit trail gate: ALL requiresHumanConfirm transitions by liaison must include `human_answer` (exact decision text), `human_answer_at` (ISO timestamp), `approval_mode` (auto/semi/auto-approval/manual) in DNA. Permanent audit trail — fields never cleared. Addresses 2026-03-02 autonomous approval incident and 2026-03-12 lost decision text. Engine validates all 3 fields + approval_mode enum before allowing transition | DEV |
