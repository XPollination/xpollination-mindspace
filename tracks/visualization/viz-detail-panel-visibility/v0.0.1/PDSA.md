# PDSA: Fix Detail Panel Visibility After Drill-Down

**Task:** `viz-detail-panel-visibility`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Clicking a capability card or task row in Mission Dashboard writes content to the detail panel but the panel stays invisible.

**Root cause:** CSS class mismatch between drill-down functions and CSS rule.
- CSS rule (line 502): `.detail-panel.visible { display: block }`
- `showDetail()` (Kanban, line 1748): `classList.add('visible')` — CORRECT
- `showCapabilityDetail()` (line 2385): `classList.add('open')` — WRONG
- `showTaskDetail()` (line 2432): `classList.add('open')` — WRONG

The `open` class has no CSS rule, so the panel content renders into an invisible element.

### Fix (v0.0.25 index.html)

Two lines changed:

```javascript
// Line 2385 — showCapabilityDetail():
// BEFORE: detailPanel.classList.add('open');
// AFTER:  detailPanel.classList.add('visible');

// Line 2432 — showTaskDetail():
// BEFORE: detailPanel.classList.add('open');
// AFTER:  detailPanel.classList.add('visible');
```

### Files Changed

| File | Change |
|------|--------|
| `viz/versions/v0.0.25/index.html` | Lines 2385, 2432: `'open'` → `'visible'` |

### Verification Plan

1. Click capability card in Mission view → detail panel appears with capability data
2. Click task row in capability detail → detail panel shows task detail
3. Kanban card click still works (showDetail unchanged)
4. hideDetail() still works (already uses `classList.remove('visible')`)

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
