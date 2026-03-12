# PDSA: Hard Gate — Log Human Approval Answer in DNA

**Task:** `approval-answer-logging`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

When LIAISON executes human-decision transitions (approval→approved, review→complete, etc.), only `liaison_reasoning` is stored in DNA. This field is written by the LIAISON agent, not the human. The human's actual answer (e.g., "approve", "rework with feedback X") is lost from the audit trail.

**Incident context:** On 2026-03-02, LIAISON autonomously approved 4 PDSA designs without presenting them to Thomas. The current `requiresHumanConfirm` gate enforces `human_confirmed` in manual/auto-approval modes but doesn't capture what the human actually said.

### Current State

The workflow engine (v0.0.18) has:
- `requiresHumanConfirm: true` on affected transitions
- `human_confirmed` + `human_confirmed_via=viz` enforcement in manual/auto-approval modes
- `liaison_reasoning` field — set by LIAISON, not validated by engine
- No field for the human's actual decision text

**Affected transitions** (all with `requiresHumanConfirm: true`):
| Transition | Line in workflow-engine.js |
|-----------|---------------------------|
| `approval→approved` | Line 53 |
| `approval→complete` | Line 55 |
| `approval→rework` | Line 57 |
| `review→complete` (liaison) | Line 83 |
| `review→rework:liaison` | Line 89 |

### Design Decisions

**D1: Add `human_answer` as a required DNA field for all `requiresHumanConfirm` transitions.**

In `interface-cli.js`, when a transition has `requiresHumanConfirm: true` AND actor is `liaison`:
```javascript
// After existing human_confirmed checks (line 660-672):
if (!dna.human_answer) {
  error(`LIAISON transition ${transitionKey} requires dna.human_answer — the exact human decision text.`);
}
if (!dna.human_answer_at) {
  error(`LIAISON transition ${transitionKey} requires dna.human_answer_at — ISO timestamp of human decision.`);
}
```

This applies in ALL modes (auto, semi, manual) — the answer must always be logged. The difference by mode is:
- **auto:** LIAISON sets `human_answer` itself (e.g., "AUTO-APPROVE: <reasoning>")
- **semi:** LIAISON captures Thomas's typed response as `human_answer`
- **manual:** Viz UI sets `human_answer` when Thomas clicks the button
- **auto-approval:** LIAISON sets for approvals, viz sets for completions

**D2: Add `approval_mode` field — which mode was active when the decision was made.**

```javascript
if (!dna.approval_mode) {
  error(`LIAISON transition ${transitionKey} requires dna.approval_mode — the mode active when human decided.`);
}
if (!['auto', 'semi', 'auto-approval', 'manual'].includes(dna.approval_mode)) {
  error(`Invalid approval_mode: ${dna.approval_mode}. Must be auto, semi, auto-approval, or manual.`);
}
```

**D3: These fields are logged, not cleared after use.**

Unlike `human_confirmed` (which is cleared after use as a one-time gate), `human_answer`, `human_answer_at`, and `approval_mode` are permanent audit trail entries. They stay in DNA for the life of the task.

**D4: LIAISON can set `human_answer` via update-dna.**

Unlike `human_confirmed` (blocked from CLI for liaison), `human_answer` must be settable by LIAISON — in auto/semi modes, LIAISON is the one who records the answer. Remove the field from any blocked-fields list if present.

**D5: Workflow version bump to v0.0.19.**

Document the new gate in WORKFLOW.md v0.0.19. Add to the changelog at the bottom.

### Implementation

**File 1: `src/db/interface-cli.js`**

In the `cmdTransition` function, after the existing `requiresHumanConfirm` checks (around line 660-672), add:

```javascript
// Human answer audit trail (all modes)
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  if (!dna.human_answer) {
    error(`Transition ${transitionKey} requires dna.human_answer — record the human decision.`);
  }
  if (!dna.human_answer_at) {
    error(`Transition ${transitionKey} requires dna.human_answer_at — ISO timestamp of decision.`);
  }
  if (!dna.approval_mode || !['auto', 'semi', 'auto-approval', 'manual'].includes(dna.approval_mode)) {
    error(`Transition ${transitionKey} requires dna.approval_mode (auto|semi|auto-approval|manual).`);
  }
}
```

**File 2: `tracks/process/context/workflow/v0.0.19/WORKFLOW.md`**

Copy v0.0.18, add section:

```markdown
### Human Answer Audit Trail (v0.0.19)

All `requiresHumanConfirm` transitions require three additional DNA fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `human_answer` | string | Yes | Exact text of human decision |
| `human_answer_at` | string (ISO) | Yes | When the decision was made |
| `approval_mode` | enum | Yes | Which mode was active: auto, semi, auto-approval, manual |

These fields are permanent — they form the audit trail and are never cleared.

**Per mode:**
- **auto:** LIAISON sets `human_answer` = "AUTO-APPROVE: <reasoning>" or "AUTO-REWORK: <reasoning>"
- **semi:** LIAISON captures Thomas's typed response verbatim
- **auto-approval:** LIAISON sets for approve/rework, viz sets for complete
- **manual:** Viz UI sets when Thomas clicks the button
```

### Files Changed

| File | Change |
|------|--------|
| `src/db/interface-cli.js` | Add human_answer, human_answer_at, approval_mode validation for requiresHumanConfirm transitions |
| `tracks/process/context/workflow/v0.0.19/WORKFLOW.md` | New version documenting human answer audit trail gate |

### Verification Plan

1. **semi mode:** LIAISON transition without `human_answer` → error message requiring the field
2. **semi mode:** LIAISON transition with all 3 fields → succeeds
3. **auto mode:** LIAISON sets `human_answer="AUTO-APPROVE: ..."` → succeeds
4. **manual mode:** Viz sets fields via confirm endpoint → transition succeeds
5. **Invalid approval_mode:** `approval_mode="invalid"` → error
6. **Non-liaison actor:** pdsa/qa/dev transitions not affected (no requiresHumanConfirm check for their transitions)
7. **Fields persist:** After successful transition, `human_answer`, `human_answer_at`, `approval_mode` remain in DNA
8. **All 5 transitions covered:** approval→approved, approval→complete, approval→rework, review→complete, review→rework:liaison

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
