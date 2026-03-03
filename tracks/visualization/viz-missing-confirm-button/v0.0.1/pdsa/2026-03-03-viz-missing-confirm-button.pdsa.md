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

### Sub-Problem 4: Update Version Symlink

**What:** After dev implements, update `viz/versions/v0.0.1/` copies to match root files.

The active symlink `viz/active → versions/v0.0.1` must serve the updated files. Dev should copy modified `index.html` and `server.js` to `viz/versions/v0.0.1/` as part of the implementation.

---

## Files to Modify

| File | Changes |
|------|---------|
| `viz/index.html` | Replace confirm button with Approve + Rework buttons; add pulsing border CSS; add rework handler JS |
| `viz/server.js` | Add `PUT /api/node/:slug/rework` endpoint |
| `viz/versions/v0.0.1/index.html` | Mirror root changes |
| `viz/versions/v0.0.1/server.js` | Mirror root changes |

---

## STUDY — Verification Plan

| AC | How to verify |
|----|---------------|
| 1. Confirm visible at `approval` + MANUAL | Set a task to approval, set mode to manual, open detail panel → Approve button visible |
| 2. Confirm visible at `review+liaison` + MANUAL | Set a task to review with role=liaison, set mode to manual → Approve button visible |
| 3. Clicking Approve sets `human_confirmed=true` | Click Approve → check DNA in DB → `human_confirmed: true` |
| 4. Both Approve and Rework available | Both buttons rendered side-by-side in detail panel |
| 5. Buttons clearly visible | Pulsing amber border on packages needing action; buttons prominent in detail panel |

**QA test approach:** Source-level regex tests for button IDs, endpoint routes, CSS animation, and conditional rendering. Runtime DOM tests not in scope (no browser test infra).

---

## ACT — Decisions

- **Viz is UI, not workflow engine.** Buttons set DNA flags; LIAISON agent executes transitions. This is by design — the viz should never bypass the workflow engine.
- **Rework gets a reason field.** Optional text input or default string. Stored as `human_rework_reason` in DNA.
- **Pulsing border for visibility.** Amber (#f59e0b) matches rework color in the existing palette. Pulse animation is lightweight CSS.
- **No confirmation dialog.** Approve and Rework are reversible (LIAISON reads flags, hasn't transitioned yet). Keep the UI fast.
