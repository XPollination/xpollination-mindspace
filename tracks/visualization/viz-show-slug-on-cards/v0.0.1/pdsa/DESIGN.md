# PDSA: Viz Show Slug on Cards — v0.0.1

## PLAN

### Problem
Kanban cards show truncated title, role badge, and status — but NOT the slug. The slug is in the `title` attribute (tooltip) but not visible. Thomas has to click into object details to identify tasks.

### Current Card Structure
```
┌──────────────────────────┐
│ [PDSA] task-title-trun.. │  ← title (truncated), role badge
│ ● active    task         │  ← status dot + type
└──────────────────────────┘
```

### Design
Add a slug line between the header and status. Monospace, smaller font, muted color.

```
┌──────────────────────────┐
│ [PDSA] task-title-trun.. │  ← title, role badge
│ viz-show-slug-on-cards   │  ← slug (NEW)
│ ● active    task         │  ← status, type
└──────────────────────────┘
```

### Changes

1. **`viz/index.html`** (~4 lines):
   - Add slug line after `task-card-header` div in BOTH card templates (Kanban column cards at line ~1226 and blocked section cards at line ~1278)
   - CSS: `.task-card-slug-line { font-size: 10px; font-family: monospace; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
   - HTML: `<div class="task-card-slug-line">${escapeHtml(node.slug)}</div>`

2. **Versioned copies**: Apply same change to `viz/versions/v0.0.2/index.html` and future v0.0.3

### What This Does NOT Do
- Does NOT change existing `task-card-slug` class (which shows title, not slug — confusing name but changing it risks breaking existing CSS/tests)
- Does NOT truncate the slug (slugs are already concise identifiers)

## DO

Implementation by DEV agent. ~4 lines: 1 CSS class + 1 HTML line per card template (2 templates).

## STUDY

Verify slug visible on cards without clicking. Verify cards remain clean and readable.

## ACT

If approved: consider renaming `task-card-slug` CSS class to `task-card-title` in a future cleanup.
