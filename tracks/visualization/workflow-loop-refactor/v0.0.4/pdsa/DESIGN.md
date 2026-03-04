# PDSA: Viz Workflow Redesign — v0.0.4

## REWORK CONTEXT

> **Thomas feedback (2026-03-04, liaison_rework_reason_4):**
> "light mode works but there are some parts that are still in dark: Project Filter, manual semi auto, Refresh and version history buttons and version history popup. maybe you find more but i found those. rest is good."

Thomas APPROVED: Detail auto-refresh, collapsible blocked section, blocked/cancelled filter, most of light mode.
Thomas REQUIRES: Complete light mode CSS coverage for ALL UI elements.

## PLAN

### Problem

Light mode toggle works but several UI elements still render with dark-theme colors. Thomas identified 5 elements; a full audit reveals more.

### Missing Light Mode Overrides (Full Audit)

#### Thomas-reported elements:

1. **Project Filter dropdown** (`.project-dropdown`): Background `#16213e`, color `#e94560`, border `#e94560`. Needs light override.

2. **Liaison mode selector** (`#liaison-mode`): Inline styles `background:#2a2a2a;color:#ccc;border:1px solid #555`. Needs light override.

3. **Refresh button** (`#refresh-btn`): No explicit styles — inherits from header context but no light override.

4. **Version History button** (`#version-history-btn`): Inline styles `background:#2a2a2a;color:#ccc;border:1px solid #555`. Needs light override.

5. **Version History popup** (`.past-changes-content`): Background `#16213e`, border `#0f3460`. Text colors `#ccc`, `#888`. Needs light override.

#### Additional elements found in audit:

6. **Changelog modal** (`.changelog-modal-content`): Same dark background `#16213e`, list items `#ccc`. Needs light override.

7. **Update banner** (`.update-banner`): Dark gradient background. Needs light override.

8. **Stats bar** (`.stats-bar`): Color `#888`. Needs light override.

9. **Blocked filter buttons** (`.blocked-filter-btn`): Border `#555`, color `#888`. Needs light override.

10. **Collapse toggle** (`.collapse-toggle`): Inherits from blocked bar, may need override.

11. **Header subtitle** (`.header-subtitle`): Color `#888`. Needs light override.

### Design

Add `body.light-mode` overrides for all identified elements. Group by area.

```css
/* Header controls */
body.light-mode .project-dropdown {
  background: #fff;
  color: #e94560;
  border-color: #e94560;
}
body.light-mode .project-dropdown:hover {
  background: #f0f0f0;
}
body.light-mode #liaison-mode {
  background: #fff !important;
  color: #333 !important;
  border-color: #ccc !important;
}
body.light-mode #refresh-btn {
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
}
body.light-mode #version-history-btn {
  background: #fff !important;
  color: #333 !important;
  border-color: #ccc !important;
}
body.light-mode .stats-bar { color: #555; }
body.light-mode .header-subtitle { color: #666; }

/* Modals and popups */
body.light-mode .past-changes-content {
  background: #fff;
  border-color: #ccc;
}
body.light-mode .past-changes .version-entry {
  border-bottom-color: #ddd;
}
body.light-mode .past-changes .version-changes li { color: #444; }
body.light-mode .past-changes .version-date { color: #666; }

body.light-mode .changelog-modal-content {
  background: #fff;
  border-color: #ccc;
}
body.light-mode .changelog-modal .changelog-list li { color: #444; }

body.light-mode .update-banner {
  background: linear-gradient(135deg, #e8e8e8, #f5f5f5);
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
body.light-mode .update-banner button {
  border-color: #ccc;
  background: #fff;
  color: #333;
}

/* Blocked section controls */
body.light-mode .blocked-filter-btn {
  border-color: #ccc;
  color: #555;
}
body.light-mode .collapse-toggle { color: #555; }
```

Note: `#liaison-mode` and `#version-history-btn` have inline styles, so `!important` is needed to override them. The Refresh button has no explicit dark styles but will inherit from the header.

### Changes Required

1. **`viz/index.html`** (~40 lines):
   - Add all missing `body.light-mode` CSS overrides after the existing light mode block (after line 779)

2. **`viz/versions/v0.0.4/`**: Copy updated files, update `active` symlink

3. **`viz/versions/v0.0.4/changelog.json`**: New changelog entry

### What This Does NOT Do

- Does NOT change any dark mode colors (approved)
- Does NOT change light mode's base colors (background #f5f5f5, text #222 — approved)
- Does NOT restructure any HTML or JS logic
- Does NOT affect functionality — purely CSS additions

### Acceptance Criteria (v0.0.4)

1. Project Filter dropdown readable in light mode (light background, dark text, accent border)
2. Liaison mode selector readable in light mode
3. Refresh button readable in light mode
4. Version History button readable in light mode
5. Version History popup has light background with dark text
6. Changelog modal has light background with dark text
7. Update banner has light background
8. All header text (stats, subtitle) visible in light mode
9. Blocked section filter buttons visible in light mode
10. v0.0.4 directory created, active symlink updated
11. v0.0.3 preserved (rollback available)

## DO

Implementation by DEV agent. ~40 lines CSS additions in `viz/index.html`. No JS changes.

## STUDY

After implementation:
- Toggle to light mode, verify EVERY UI element is readable
- Check: project dropdown, liaison mode, refresh, version history, all popups
- Check: blocked section buttons, stats bar, header subtitle
- Toggle back to dark mode, verify nothing changed

## ACT

If Thomas approves: v0.0.4 becomes active. Light mode coverage is complete.
