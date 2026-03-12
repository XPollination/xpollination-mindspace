# PDSA: WORKFLOW v0.0.18 Approval Mode Enforcement Matrix

**Task:** `wf-v18-approval-mode-enforcement`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The current engine gate logic in `interface-cli.js` (lines 625-655) does not implement the WORKFLOW v0.0.18 enforcement matrix. Specifically:

1. **Only manual mode is enforced.** The gate checks `modeValue === 'manual'` and requires `human_confirmed + via=viz`. All other modes (auto, auto-approval, semi) pass through with zero enforcement.
2. **Auto-approval mode has no gate at all.** The v0.0.18 spec requires auto-approval to gate completion transitions (`→ complete`) with `human_confirmed + via=viz`.
3. **`review→rework:liaison` missing `requiresHumanConfirm`.** In `workflow-engine.js` line 89, this transition has no `requiresHumanConfirm: true`, so the gate in `interface-cli.js` never triggers for it in manual mode.
4. **`complete→rework` blocked by immutability.** The transition requires `rework_target_role` in DNA (line 96 of workflow-engine.js), but the immutability rule (line 836 of interface-cli.js) blocks all DNA updates on complete tasks. No way to set `rework_target_role` before transitioning.
5. **Viz buttons only show in manual mode.** Line 1500 of `index.html` shows Approve/Rework buttons only when `liaisonModeSelect.value === 'manual'`. No "Complete" button exists at all. Auto-approval mode's completion gate is unenforceable without a Complete button.

### Incidents Motivating This Change

- **2026-03-02:** 4 tasks auto-completed by liaison in semi mode — protocol enforcement failed
- **2026-03-12:** 4 more tasks auto-completed — same failure pattern

### Target State (WORKFLOW v0.0.18 Enforcement Matrix)

| Transition | Auto | Auto-Approval | Semi | Manual |
|------------|------|---------------|------|--------|
| `approval → approved` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `approval → complete` | free | `human_confirmed` + `via=viz` | protocol only | `human_confirmed` + `via=viz` |
| `approval → rework` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `review+liaison → complete` | free | `human_confirmed` + `via=viz` | protocol only | `human_confirmed` + `via=viz` |
| `review+liaison → rework` | free | free | protocol only | `human_confirmed` + `via=viz` |
| `complete → rework` | protocol only | protocol only | protocol only | protocol only |

### Design: 4 Implementation Changes

#### Change 1: Rewrite gate logic in `interface-cli.js` (lines 625-655)

**Current code** (simplified):
```javascript
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  const modeValue = mode?.value || 'auto';
  if (modeValue === 'manual') {
    // require human_confirmed + via=viz
  }
  // semi: no enforcement
  // auto: no enforcement
}
```

**New code** — replace with matrix-based logic:
```javascript
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  const modeValue = mode?.value || 'auto';

  // Determine if this is a completion transition (terminal — closes work)
  const isCompletionTransition = (newStatus === 'complete');

  const requiresVizConfirm =
    (modeValue === 'manual') ||
    (modeValue === 'auto-approval' && isCompletionTransition);

  if (requiresVizConfirm) {
    if (!dna.human_confirmed) {
      error(`LIAISON ${modeValue} mode: ${transitionKey} requires human confirmation via mindspace viz. Click the button in viz UI.`);
    }
    if (dna.human_confirmed_via !== 'viz') {
      error(`LIAISON ${modeValue} mode: ${transitionKey} requires human_confirmed_via='viz'. Current: '${dna.human_confirmed_via || 'none'}'.`);
    }
    // Clear after use (one-time confirmation)
    delete dna.human_confirmed;
    delete dna.human_confirmed_via;
  }
  // auto mode: no enforcement (free)
  // semi mode: no enforcement (protocol only)
  // auto-approval non-completion: no enforcement (free)
}
```

**Key design decisions:**
- `isCompletionTransition` is simply `newStatus === 'complete'`. This correctly covers both `approval→complete` and `review→complete` (the two completion transitions in the matrix).
- Auto-approval gates only completions. Approval-direction (`→ approved`) and rework-direction (`→ rework`) are free.
- Semi mode has zero engine enforcement — same as auto. Protocol enforcement is the liaison agent's responsibility.
- `complete→rework` is protocol-only across all modes (no `requiresHumanConfirm` needed — see Change 2 note).

#### Change 2: Add `requiresHumanConfirm` to `review→rework:liaison` in `workflow-engine.js`

**File:** `src/db/workflow-engine.js`, line 89

**Current:**
```javascript
'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', clearsDna: [...], requiresDna: ['rework_target_role'] },
```

**New:**
```javascript
'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', clearsDna: [...], requiresDna: ['rework_target_role'], requiresHumanConfirm: true },
```

**Why:** Without this flag, the gate in `interface-cli.js` never triggers for `review+liaison→rework`. Manual mode cannot enforce `human_confirmed + via=viz` on this transition.

**Note on `complete→rework`:** This transition already has `requiresHumanConfirm: true` (line 96), but the enforcement matrix says it's "protocol only" across all modes. The gate logic in Change 1 handles this correctly: when `modeValue` is `auto`/`semi`/`auto-approval`, non-completion transitions are free. In manual mode, `complete→rework` would normally be gated, but per v0.0.18, it should remain protocol-only. Two options:
- **Option A:** Remove `requiresHumanConfirm` from `complete→rework` rule. Then the gate never triggers.
- **Option B:** Keep it but add explicit check: if `fromStatus === 'complete' && newStatus === 'rework'`, skip enforcement.

**Recommendation:** Option A — remove `requiresHumanConfirm` from `complete→rework`. It's cleaner: the engine rule should match the enforcement matrix. Protocol-only means no engine gate.

#### Change 3: Fix `complete→rework` immutability bypass in `interface-cli.js`

**Problem:** `complete→rework` requires `rework_target_role` in DNA (per `requiresDna`), but the `update-dna` command rejects all updates to complete tasks (line 836). There's no way to set `rework_target_role` before transitioning.

**Solution:** In `cmdTransition()`, accept `rework_target_role` as a CLI parameter for `complete→rework` specifically. The transition command writes it to DNA before validating transition rules.

**Implementation:**

In `cmdTransition()` (around where the transition is validated), add:
```javascript
// Narrow immutability bypass: complete→rework needs rework_target_role in DNA
// Accept it as a transition parameter since update-dna blocks complete tasks
if (fromStatus === 'complete' && newStatus === 'rework') {
  // Read rework_target_role from CLI args (e.g., --rework-target-role=dev)
  const reworkTargetArg = args.find(a => a.startsWith('--rework-target-role='));
  if (reworkTargetArg) {
    dna.rework_target_role = reworkTargetArg.split('=')[1];
  }
}
```

**CLI usage:**
```bash
node interface-cli.js transition <slug> rework liaison --rework-target-role=dev
```

**Scope:** This is NOT a general removal of the immutability rule. Only `rework_target_role`, only during `complete→rework`, only written to DNA before the transition validates.

**Alternative considered:** Making `update-dna` allow `rework_target_role` on complete tasks. Rejected — the immutability rule protects against accidental modification. A narrow bypass in the transition command is safer.

#### Change 4: Viz buttons — Complete button + conditional display

**File:** `viz/index.html` (line 1500 area) and `viz/server.js` (confirm endpoint)

**Current state:**
- Approve and Rework buttons only show when `liaisonModeSelect.value === 'manual'` (line 1500)
- No "Complete" button exists
- The `/api/node/:slug/confirm` endpoint sets `human_confirmed=true, human_confirmed_via=viz`

**Required changes:**

**4a. Show buttons based on mode + transition type:**

| Button | When to show |
|--------|-------------|
| **Approve** | `approval+liaison` cards, modes: manual |
| **Complete** | `approval+liaison` cards (research tasks) + `review+liaison` cards, modes: manual, auto-approval |
| **Rework** | `approval+liaison` + `review+liaison` cards, modes: manual |

Logic: buttons show when the mode requires viz confirmation for that transition.

**4b. Add Complete button HTML:**
```html
<button id="complete-task-btn" style="background:#3b82f6;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;"
  data-slug="${node.slug}" data-project="${dna._project || ''}">Complete</button>
```

**4c. Complete button click handler:**
Uses the same `/api/node/:slug/confirm` endpoint (sets `human_confirmed=true, human_confirmed_via=viz`). The liaison agent then executes the `→ complete` transition via CLI.

**4d. Display condition (replacing line 1500):**
```javascript
const isApprovalLiaison = (node.status === 'approval' && dna.role === 'liaison');
const isReviewLiaison = (node.status === 'review' && dna.role === 'liaison');
const mode = liaisonModeSelect.value;

// Completion buttons: show in manual + auto-approval (gated transitions)
const showComplete = (isApprovalLiaison || isReviewLiaison) && (mode === 'manual' || mode === 'auto-approval');
// Approve/Rework buttons: show in manual only (free in auto-approval)
const showApproveRework = (isApprovalLiaison || isReviewLiaison) && mode === 'manual';
```

### Files Changed (Summary)

| File | Change | Lines |
|------|--------|-------|
| `src/db/interface-cli.js` | Rewrite gate logic (Change 1) | ~625-655 |
| `src/db/interface-cli.js` | Add `--rework-target-role` parameter (Change 3) | cmdTransition area |
| `src/db/workflow-engine.js` | Add `requiresHumanConfirm` to `review→rework:liaison` (Change 2) | 89 |
| `src/db/workflow-engine.js` | Remove `requiresHumanConfirm` from `complete→rework` (Change 2 note) | 96 |
| `viz/index.html` | Add Complete button + conditional display logic (Change 4) | ~1500 |

### Verification Plan

After implementation, verify:

1. **Auto mode:** All 6 transitions pass freely (no gate)
2. **Auto-approval mode:**
   - `approval→approved` passes freely
   - `approval→rework` passes freely
   - `review+liaison→rework` passes freely
   - `approval→complete` BLOCKED without `human_confirmed+via=viz`
   - `review+liaison→complete` BLOCKED without `human_confirmed+via=viz`
   - After viz confirm click: both complete transitions succeed
3. **Semi mode:** All 6 transitions pass freely (protocol only)
4. **Manual mode:**
   - All 5 transitions with `requiresHumanConfirm` BLOCKED without `human_confirmed+via=viz`
   - `complete→rework` passes freely (protocol only)
   - After viz confirm click: all gated transitions succeed
5. **Protection:** `node interface-cli.js update-dna <slug> '{"human_confirmed":true}' liaison` still rejected (line 822-824)
6. **Complete→rework:** Works with `--rework-target-role=dev` parameter, bypasses immutability for that field only
7. **Viz buttons:** Complete button shows on `review+liaison` cards in auto-approval and manual modes

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
