# PDSA: viz-missing-confirm-button v0.0.1

**Date:** 2026-03-03
**Author:** PDSA Agent
**Task:** Bug: No Confirm button in viz for MANUAL approval mode
**Status:** Design

---

## PLAN

### Problem Statement

When `liaison-approval-mode` is MANUAL, Thomas must click Confirm/Rework in the viz UI. The current implementation has a Confirm button, but it has five deficiencies that make the MANUAL flow broken:

1. **Hidden in detail panel** — button only appears after clicking a task to open the side panel. No visual indicator on the task package itself that action is needed.
2. **No Rework option** — only "Confirm (approve for LIAISON)" exists. Thomas cannot reject/rework from the UI.
3. **No workflow transition** — clicking Confirm only sets `human_confirmed=true` in DNA. It does NOT execute a workflow transition (`complete` or `rework`). LIAISON agent must still run the transition separately.
4. **Server endpoint is confirm-only** — `PUT /api/node/:slug/confirm` (server.js:341-384) only sets `human_confirmed=true`. No rework endpoint exists.
5. **No visual cue on task packages** — tasks awaiting manual action look identical to other tasks. Thomas has no way to scan the viz and see which tasks need his attention.

### Current Code (index.html lines 1360-1399)

```javascript
// Condition: approval OR (review + liaison role) AND manual mode
${(node.status === 'approval' || (node.status === 'review' && dna.role === 'liaison'))
  && liaisonModeSelect.value === 'manual' ? `
<div class="detail-field" ...>
  <button id="confirm-task-btn" ...>Confirm (approve for LIAISON)</button>
  ${dna.human_confirmed ? '<span ...>Confirmed</span>' : ''}
</div>
` : ''}
```

**Confirm handler** (lines 1376-1399): calls `PUT /api/node/${slug}/confirm`, sets `human_confirmed=true`, disables button.

**Server endpoint** (server.js lines 341-384): reads slug, finds node, sets `dna.human_confirmed = true`, saves. No transition.

### Acceptance Criteria (from DNA)

1. Confirm button visible in viz for tasks at `approval` status when MANUAL mode
2. Confirm button visible for tasks at `review+liaison` status when MANUAL mode
3. Clicking Confirm sets `human_confirmed=true` in DNA
4. Approve and Rework options both available
5. Button is clearly visible and accessible — not hidden behind scroll or conditional rendering

---

## DO — Design

### Sub-Problem 1: Action Buttons in Detail Panel (Fix Existing)

**What:** Replace the single "Confirm" button with two buttons: **Approve** (green) and **Rework** (red/orange).

**Detail panel changes (index.html):**

Replace the current confirm button block (lines 1360-1365) with:

```html
${(node.status === 'approval' || (node.status === 'review' && dna.role === 'liaison'))
  && liaisonModeSelect.value === 'manual' ? `
<div class="detail-field" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;">
  <div style="display: flex; gap: 8px; align-items: center;">
    <button id="approve-task-btn"
      style="background:#22c55e;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;"
      data-slug="${node.slug}" data-project="${dna._project || ''}"
      ${dna.human_confirmed ? 'disabled style="background:#666;..."' : ''}>
      Approve
    </button>
    <button id="rework-task-btn"
      style="background:#f59e0b;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;"
      data-slug="${node.slug}" data-project="${dna._project || ''}"
      ${dna.human_confirmed ? 'disabled' : ''}>
      Rework
    </button>
    ${dna.human_confirmed ? '<span style="color:#22c55e;margin-left:8px;font-size:12px;">Approved</span>' : ''}
    ${dna.human_rework_reason ? '<span style="color:#f59e0b;margin-left:8px;font-size:12px;">Rework requested</span>' : ''}
  </div>
</div>
` : ''}
```

**Approve handler:** Same as current confirm — calls `PUT /api/node/${slug}/confirm` which sets `human_confirmed=true`.

**Rework handler:** New — calls `PUT /api/node/${slug}/rework` with optional `reason`. Sets `human_rework_reason` in DNA. (Thomas can type reason or leave blank.)

### Sub-Problem 2: Rework Endpoint (server.js)

**What:** Add `PUT /api/node/:slug/rework` endpoint alongside existing confirm endpoint.

**Logic:**
```javascript
const reworkMatch = pathname.match(/^\/api\/node\/([^/]+)\/rework$/);
if (reworkMatch && req.method === 'PUT') {
  // Read slug, body.project, body.reason
  // Find node in DB
  // Set dna.human_rework_reason = reason || 'Rework requested via viz'
  // Set dna.human_confirmed = false (explicitly clear any prior confirm)
  // Save to DB
  // Return { success: true, slug, status, human_rework_reason }
}
```

**Important:** Neither confirm nor rework endpoints execute workflow transitions. They set DNA flags that the LIAISON agent reads. The LIAISON agent is responsible for running `transition <slug> complete liaison` or `transition <slug> rework liaison` based on these flags. This preserves the separation: viz is a UI, not a workflow engine.

### Sub-Problem 3: Visual Indicator on Task Packages

**What:** Add a pulsing border or icon on task packages that need MANUAL action, so Thomas can spot them without opening the detail panel.

**Condition:** Same as button condition — `(status === 'approval' || (status === 'review' && role === 'liaison')) && manualMode`.

**Implementation in `renderSection()` or relevant render function:**

Add a pulsing gold/amber border to packages needing action:

```javascript
// In the package rendering, after creating the rect:
if ((node.status === 'approval' || (node.status === 'review' && dna.role === 'liaison'))
    && liaisonModeSelect.value === 'manual'
    && !dna.human_confirmed && !dna.human_rework_reason) {
  // Add pulsing border animation
  rect.setAttribute('stroke', '#f59e0b');
  rect.setAttribute('stroke-width', '2');
  rect.classList.add('needs-action');
}
```

Add CSS animation:
```css
@keyframes pulse-border {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.3; }
}
.needs-action { animation: pulse-border 2s ease-in-out infinite; }
```

This gives Thomas an at-a-glance visual: pulsing amber border = "click me, I need your decision."

### Sub-Problem 4: Engine Enforcement — Prevent LIAISON Bypass (REWORK ADDITION)

**Context:** The rework feedback identifies that MANUAL mode enforcement must be systemic, not just skill-instruction-based. Currently, LIAISON can bypass MANUAL mode by calling `update-dna <slug> '{"human_confirmed":true}'` directly, then executing the transition. The engine gate at `interface-cli.js:487-505` checks `dna.human_confirmed` but cannot verify WHO set it.

**Current enforcement (interface-cli.js:487-505):**
```javascript
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  if (modeValue === 'manual') {
    if (!dna.human_confirmed) {
      error('LIAISON manual mode active. Set dna.human_confirmed=true via mindspace viz...');
    }
    delete dna.human_confirmed; // one-time use
  }
}
```

This blocks transitions when `human_confirmed` is absent, which is correct. The gap: LIAISON can set it via `update-dna`.

**Fix: Source verification via `human_confirmed_via` field.**

The viz confirm endpoint (`PUT /api/node/:slug/confirm`) should set TWO fields:
```javascript
dna.human_confirmed = true;
dna.human_confirmed_via = 'viz';  // source marker
```

The engine gate (interface-cli.js) should check BOTH:
```javascript
if (modeValue === 'manual') {
  if (!dna.human_confirmed || dna.human_confirmed_via !== 'viz') {
    error('LIAISON manual mode: human_confirmed must be set via viz UI, not update-dna.');
  }
  delete dna.human_confirmed;
  delete dna.human_confirmed_via;
}
```

**Why this works:**
- `update-dna` can set `human_confirmed=true`, but an agent wouldn't know to also set `human_confirmed_via='viz'`
- Even if an agent guesses it, it's a clear protocol violation (auditable)
- The viz endpoint is the ONLY code that sets `human_confirmed_via='viz'`

**Similarly for rework:** The viz rework endpoint sets:
```javascript
dna.human_rework_reason = reason;
dna.human_rework_via = 'viz';
```

And the engine's rework transition can verify `human_rework_via === 'viz'` when mode=manual.

**Files affected:**
- `viz/server.js` — confirm endpoint adds `human_confirmed_via='viz'`; rework endpoint adds `human_rework_via='viz'`
- `src/db/interface-cli.js` — engine gate checks `human_confirmed_via` field
- `src/db/workflow-engine.js` — no changes (transition rules already have `requiresHumanConfirm`)

### Sub-Problem 5: Update Version Symlink

**What:** After dev implements, update `viz/versions/v0.0.1/` copies to match root files.

The active symlink `viz/active → versions/v0.0.1` must serve the updated files. Dev should copy modified `index.html` and `server.js` to `viz/versions/v0.0.1/` as part of the implementation.

---

## Files to Modify

| File | Changes |
|------|---------|
| `viz/index.html` | Replace confirm button with Approve + Rework buttons; add pulsing border CSS; add rework handler JS |
| `viz/server.js` | Add `PUT /api/node/:slug/rework` endpoint; confirm endpoint adds `human_confirmed_via='viz'` |
| `src/db/interface-cli.js` | Engine gate checks `human_confirmed_via === 'viz'` in manual mode |
| `viz/versions/v0.0.1/index.html` | Mirror root changes |
| `viz/versions/v0.0.1/server.js` | Mirror root changes |

---

## STUDY — Verification Plan

| AC | How to verify |
|----|---------------|
| 1. Confirm visible at `approval` + MANUAL | Set a task to approval, set mode to manual, open detail panel → Approve button visible |
| 2. Confirm visible at `review+liaison` + MANUAL | Set a task to review with role=liaison, set mode to manual → Approve button visible |
| 3. Clicking Approve sets `human_confirmed=true` | Click Approve → check DNA in DB → `human_confirmed: true, human_confirmed_via: 'viz'` |
| 4. Both Approve and Rework available | Both buttons rendered side-by-side in detail panel |
| 5. Buttons clearly visible | Pulsing amber border on packages needing action; buttons prominent in detail panel |
| 6. Engine rejects LIAISON bypass | `update-dna` sets `human_confirmed=true` without `via` → `transition` fails with error |
| 7. Engine accepts viz-sourced confirm | Viz confirm → `transition` succeeds |

**QA test approach:** Source-level regex tests for button IDs, endpoint routes, CSS animation, `human_confirmed_via` in confirm endpoint, and engine gate check. Workflow engine test for bypass rejection.

---

## ACT — Decisions

- **Viz is UI, not workflow engine.** Buttons set DNA flags; LIAISON agent executes transitions. This is by design — the viz should never bypass the workflow engine.
- **Engine enforcement is the hard gate.** `human_confirmed_via='viz'` field distinguishes viz-sourced confirms from agent `update-dna` calls. This is the systemic enforcement the rework requested.
- **Rework gets a reason field.** Optional text input or default string. Stored as `human_rework_reason` in DNA.
- **Pulsing border for visibility.** Amber (#f59e0b) matches rework color in the existing palette. Pulse animation is lightweight CSS.
- **No confirmation dialog.** Approve and Rework are reversible (LIAISON reads flags, hasn't transitioned yet). Keep the UI fast.
- **Security is practical, not theoretical.** An agent COULD guess to set `human_confirmed_via='viz'`, but that's a clear protocol violation. The goal is systemic enforcement against accidental bypass, not cryptographic security.
