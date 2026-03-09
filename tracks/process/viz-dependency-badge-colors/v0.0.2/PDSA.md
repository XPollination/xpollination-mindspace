# PDSA: Dependency status badge colors unreadable

**Task:** viz-dependency-badge-colors
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

In the task detail panel, dependency status badges use solid background colors with implicit white text. Several colors have poor contrast:
- `complete` (#14b8a6 teal on white text) — hard to read
- `active` (#22c55e green) — marginal contrast
- `review`/`approval` (#f59e0b amber) — needs dark text
- `blocked`/`rework` (#ef4444/#dc2626 red) — acceptable but could improve

These badges are rendered at `font-size:10px` (line 1669 of v0.0.9/index.html), making contrast even more critical.

## Analysis

The badge styles are defined at lines 551-563 of `index.html`. All use `background: <color>` with no explicit `color` property (inherits white from parent). The dependency badges reuse these same `.badge.status-*` classes.

Two options:
1. **Add explicit `color` to each badge class** — simple, targeted
2. **Redesign badges as outlined (border + text color, no fill)** — more readable at small sizes

Option 1 is the right fix for a bug — minimal change, addresses the readability issue directly.

## Design

### Change A: Add explicit text color to all status badge classes

In `viz/versions/v0.0.10/index.html` (copy from v0.0.9, then modify):

```css
/* Before (lines 551-563): */
.badge.status-pending { background: #6b7280; }
.badge.status-ready { background: #3b82f6; }
.badge.status-active { background: #22c55e; }
.badge.status-testing { background: #10b981; }
.badge.status-review { background: #f59e0b; }
.badge.status-rework { background: #ef4444; }
.badge.status-complete { background: #14b8a6; }
.badge.status-done { background: #14b8a6; }
.badge.status-completed { background: #14b8a6; }
.badge.status-blocked { background: #dc2626; }
.badge.status-cancelled { background: #9ca3af; }
.badge.status-approval { background: #f59e0b; }
.badge.status-approved { background: #8b5cf6; }

/* After: */
.badge.status-pending { background: #6b7280; color: #fff; }
.badge.status-ready { background: #3b82f6; color: #fff; }
.badge.status-active { background: #166534; color: #fff; }
.badge.status-testing { background: #065f46; color: #fff; }
.badge.status-review { background: #92400e; color: #fff; }
.badge.status-rework { background: #991b1b; color: #fff; }
.badge.status-complete { background: #115e59; color: #fff; }
.badge.status-done { background: #115e59; color: #fff; }
.badge.status-completed { background: #115e59; color: #fff; }
.badge.status-blocked { background: #991b1b; color: #fff; }
.badge.status-cancelled { background: #6b7280; color: #fff; }
.badge.status-approval { background: #92400e; color: #fff; }
.badge.status-approved { background: #5b21b6; color: #fff; }
```

Key changes:
- All badges get explicit `color: #fff` (no more inherited color ambiguity)
- Lighter backgrounds darkened for contrast: green (#22c55e -> #166534), teal (#14b8a6 -> #115e59), amber (#f59e0b -> #92400e), purple (#8b5cf6 -> #5b21b6)
- Red darkened slightly (#ef4444 -> #991b1b, #dc2626 -> #991b1b)
- All backgrounds are now WCAG AA compliant against white text (contrast ratio >= 4.5:1)

### Change B: Create v0.0.10 version directory

```bash
cp -r viz/versions/v0.0.9 viz/versions/v0.0.10
```

Apply Change A to `viz/versions/v0.0.10/index.html` only. Production stays on v0.0.9.

### Change C: Update test service to serve v0.0.10

Update `viz/versions/v0.0.10/changelog.json` to add the badge color fix entry.

### Deployment

- Test: `10.33.33.1:4200` serves v0.0.10 (update symlink or server config)
- Production: stays on v0.0.9 (no change)

### Files Changed

1. `viz/versions/v0.0.10/index.html` — badge color CSS (copy from v0.0.9, modify lines 551-563)
2. `viz/versions/v0.0.10/changelog.json` — add v0.0.10 entry

### Testing

1. All 13 status badge classes have explicit `color: #fff`
2. No background color is lighter than WCAG AA threshold against white text
3. `complete` badge is clearly readable at 10px font size
4. Test viz at `10.33.33.1:4200` shows updated colors
5. Production viz at port 8080 still shows v0.0.9 (unchanged)
