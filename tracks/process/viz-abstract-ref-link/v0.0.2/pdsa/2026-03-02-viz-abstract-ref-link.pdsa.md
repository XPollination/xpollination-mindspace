# PDSA: Viz — Display abstract_ref Link in Detail Panel

**Date:** 2026-03-02
**Task:** viz-abstract-ref-link
**Version:** v0.0.2
**Status:** PLAN

## Plan

### Problem
The object detail panel in `viz/index.html` shows `pdsa_ref` as a clickable GitHub link (lines 1187-1210), but `abstract_ref` is not displayed. The abstract is the completion documentation — a required DNA field for `review->complete` transitions.

### Design

Add `abstract_ref` rendering after the `pdsa_ref` block (line 1210) and before the ID field (line 1211), using the same rendering pattern.

#### Code to Add (after line 1210):

```html
${dna.abstract_ref ? `
<div class="detail-field">
  <label>Abstract</label>
  <div class="dual-links">
    <div class="dual-link pdsa-name" style="color: #60a5fa; font-weight: 500; margin-bottom: 4px;">
      ${dna.abstract_ref.split('/').pop().replace('.abstract.md', '') || 'Completion Abstract'}
    </div>
    ${dna.abstract_ref.startsWith('https://')
      ? `<div><a href="${dna.abstract_ref}" target="_blank" class="dual-link git-link">${dna.abstract_ref}</a></div>`
      : `<div class="dual-link" style="font-family: monospace; font-size: 11px; color: #666;">${dna.abstract_ref}</div>`
    }
  </div>
</div>
` : ''}
```

### Design Decisions
- **Color:** Blue `#60a5fa` (vs green `#22c55e` for PDSA) — visually distinct, indicates different document type
- **Label:** "Abstract" — concise, matches the DNA field name
- **File extension strip:** `.abstract.md` → clean display name
- **Same link logic:** HTTPS = clickable link, otherwise monospace text
- **Only string format:** `abstract_ref` is always a string (no legacy object format like pdsa_ref)

### Files Modified
| File | Change |
|------|--------|
| `viz/index.html` | ADD: abstract_ref rendering block after pdsa_ref (after line 1210) |

### Acceptance Criteria
| ID | Criterion |
|----|-----------|
| AC-VAL1 | abstract_ref appears in detail panel when present in DNA |
| AC-VAL2 | Renders as clickable GitHub link when starts with https:// |
| AC-VAL3 | Does NOT appear when abstract_ref is absent from DNA |
| AC-VAL4 | Label says "Abstract" |
| AC-VAL5 | Display name strips .abstract.md extension |

## Do
(To be completed by DEV agent)

## Study
- Abstract link visible for completed tasks
- Clickable GitHub URL
- Does not break existing layout

## Act
- Verify on live viz dashboard with completed tasks
