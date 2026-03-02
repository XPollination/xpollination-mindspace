# Workflow Reference - Source of Truth

**Last Updated:** 2026-03-02
**Status:** DRAFT v14 - Completion documentation gate added

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
| `review->complete` | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
| `any->cancelled` (liaison) | `abstract_ref` | `abstract_ref` must be GitHub URL | LIAISON |
| `any->cancelled` (system) | _(none)_ | System exempted from abstract gate | System |
| `any->blocked` | `blocked_reason` | Must be non-empty | Any agent |
| `ready->active` | `memory_query_session` | Must be non-empty | Claiming agent |

### Completion Documentation Gate (v14)

When a task reaches `complete` or `cancelled`, a completion abstract must exist in git and be linked via `abstract_ref` in DNA. This ensures every completed task has a documented outcome.

- **Location:** `tracks/<domain>/<task-slug>/v0.0.1/abstract/YYYY-MM-DD-<slug>.abstract.md`
- **Content:** Management summary of outcome, changes, decisions, and learnings
- **Gate:** `abstract_ref` must be a GitHub URL (hard gate on `review->complete` and liaison `any->cancelled`)
- **Exemption:** System-initiated cancellations (`any->cancelled:system`) do not require an abstract
- **Format:** See `tracks/process/context/DOCUMENTATION.md` for template and conventions

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

| Transition | Context |
|------------|---------|
| approval → approved | Human approves PDSA design |
| approval → rework | Human rejects PDSA design |
| review+liaison → complete | Human approves final result |
| review+liaison → rework | Human rejects final result |
| complete → rework | Human reopens completed task |

**Security implication:** In the agent key system, these transitions are allowed for `actor=liaison`. There is no separate "human" key - liaison's key grants authority to execute human decisions.

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
