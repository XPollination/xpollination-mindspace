# PDSA: Board Config YAML Schema Design

**Task:** `ux-board-config-schema`
**Mission:** MISSION-TASK-VIEW-UX
**Decision:** D7 — Abstract kanban board as config-driven reusable pattern
**Version:** v0.0.1
**Date:** 2026-04-08
**Author:** PDSA Agent

---

## Plan

### Problem
`kanban.js` hardcodes domain knowledge in 8+ locations: column definitions, status colors, role colors, terminal status checks, filter logic, blocked reason display, detail panel field layout, and action button conditions. Any change to the board requires JS code changes. The workflow engine (`workflow.yaml`) is already config-driven — the UI should follow the same pattern.

### Goal
Design `board-config.yaml` — a single configuration file that replaces all hardcoded rendering knowledge in `kanban.js`. The kanban board becomes a generic renderer that reads this config.

### Constraints
- Must not duplicate `workflow.yaml` concerns (transitions, gates, role routing stay in workflow.yaml)
- Must reference CSS variables for colors (the CSS theme owns actual color values)
- Must support the current Mindspace board as first instance (7 columns, 11 statuses, 4 roles)
- Must be generic enough for other use cases (content pipeline, hiring board, etc.)

### Separation of Concerns

| File | Owns | Does NOT own |
|------|------|-------------|
| `board-config.yaml` | Columns, status metadata, role labels, filters, card layout, detail sections, action buttons | Transitions, gates, routing |
| `workflow.yaml` | Transitions, gates, role routing, instructions, lease, cascade | Rendering, colors, column grouping |
| `mindspace.css` | Actual color hex values (CSS variables) | Which statuses exist, what they mean |
| `kanban.js` | Rendering engine (generic) | Domain knowledge (from config) |

---

## Do

### Schema Sections

#### 1. `board` — Board identity
```yaml
board:
  name: string     # Display name
  description: string  # What this board tracks
```

#### 2. `statuses` — All statuses the board can render
```yaml
statuses:
  {status_name}:
    label: string           # Display label
    color: string           # CSS variable reference (e.g., var(--ms-status-active))
    terminal: boolean       # true = complete/cancelled (used by filters)
    show_reason: boolean    # optional — show dna.blocked_reason on card
```

**Design decision:** `terminal` flag replaces the 4x hardcoded `['complete','cancelled']` checks in kanban.js. Code does `config.statuses[s].terminal` instead of string comparison.

**Design decision:** Colors reference CSS variables, not hex. The CSS theme owns the palette. The config just maps status → variable name. This means a different CSS theme (dark mode, high contrast) works without config changes.

#### 3. `roles` — Agent roles
```yaml
roles:
  {role_name}:
    label: string    # Display label
    color: string    # CSS variable reference
```

#### 4. `columns` — Board layout (ordered)
```yaml
columns:
  - id: string         # Unique column identifier
    label: string      # Display header
    statuses: [string]  # Which statuses map to this column
    color: string      # Column header accent color (CSS variable)
```

**Constraint:** Every status in `statuses` must appear in exactly one column. The dev task (`ux-kanban-config-driven`) should validate this at load time.

**Design decision:** Column order in the array = left-to-right order on screen. No separate `order` field needed.

#### 5. `filters` — Completed-tasks dropdown
```yaml
filters:
  default: string  # Which option is selected on first load

  options:
    - value: string           # Internal value (stored in sessionStorage)
      label: string           # Display label
      show_terminal: boolean  # true = include terminal tasks
      terminal_days: number   # optional — only show terminal within N days
```

**Design decision:** Replaces the Active/All buttons (D1). Single dropdown. The `show_terminal: false` option is the "active only" view. Options with `terminal_days` show active + recently-finished. `show_terminal: true` without `terminal_days` = show all.

#### 6. `card` — Task card layout
```yaml
card:
  title: string        # Expression: dna.title || slug
  badges:
    - field: string    # Field path (status, dna.role)
      color_from: string  # Which config section provides color (statuses, roles)
  meta:
    - field: string    # Field path
      label: string    # Display label
      truncate: number # Optional max characters
```

#### 7. `detail` — Detail panel sections
```yaml
detail:
  sections:
    - id: string
      label: string
      expanded: boolean          # Open by default?
      show_when: { status: string }  # Optional — only show for certain statuses
      fields:
        - key: string            # Field path (dna.findings, status, slug)
          label: string          # Display label
          format: string         # Renderer: text, pre, badge, link, link_list, slug_list, time, impl, review, stream, test_count
          color_from: string     # Optional — badge color source
          total_key: string      # Optional — for test_count format
```

**Format types:**
- `text` — plain text (escaped)
- `pre` — preformatted block (`<pre>`)
- `badge` — colored badge using `color_from` section
- `link` — clickable URL
- `link_list` — array of links
- `slug_list` — array of task slugs
- `time` — formatted timestamp
- `impl` — implementation object (summary + commit + branch)
- `review` — review object (verdict + notes)
- `stream` — live runner output container
- `test_count` — "{pass}/{total} passed" using `total_key`

#### 8. `actions` — Detail panel buttons
```yaml
actions:
  - id: string
    label: string
    style: string              # primary, danger, etc.
    condition:
      status_in: [string]      # Show when status is in list
      status_not_in: [string]  # Show when status is NOT in list
    transition: string         # Target status
    prompt: string             # Optional — ask user for input
    prompt_field: string       # Optional — where to store prompt input
    fields: { key: value }     # Optional — extra fields to send with transition
```

---

## Study

### Coverage Analysis

All 8 hardcoded concerns from kanban.js are addressed:

| Hardcoded concern | Config section | Lines replaced |
|-------------------|----------------|----------------|
| `COLUMNS` array (L30-38) | `columns` | 8 lines → config read |
| `STATUS_COLORS` (L46-53) | `statuses.{name}.color` | 7 lines → config lookup |
| `ROLE_COLORS` (L55-58) | `roles.{name}.color` | 4 lines → config lookup |
| `['complete','cancelled']` x4 (L78,82,130,151) | `statuses.{name}.terminal` | 4 checks → `isTerminal(s)` |
| `status === 'blocked'` check (L153) | `statuses.{name}.show_reason` | 1 check → config flag |
| `status === 'active'` for live output (L201) | `detail.sections[].show_when` | 1 check → config condition |
| Detail panel field layout (L180-251) | `detail.sections` | 70 lines → config-driven |
| Action buttons (L256-261) | `actions` | 5 lines → config-driven |

### Reusability Test

A content pipeline board would define:
```yaml
columns:
  - { id: ideas, label: Ideas, statuses: [draft, proposed] }
  - { id: writing, label: Writing, statuses: [writing, editing] }
  - { id: published, label: Published, statuses: [published] }

statuses:
  draft: { label: Draft, color: var(--cp-status-draft), terminal: false }
  published: { label: Published, color: var(--cp-status-published), terminal: true }

roles:
  writer: { label: Writer, color: var(--cp-role-writer) }
  editor: { label: Editor, color: var(--cp-role-editor) }
```

Same kanban.js, different config, different board. The schema is generic.

### D5 Incorporated

`cancelled` is in the `done` column (not `blocked`), per mission decision D5. The `blocked` column contains only `[blocked]`.

---

## Act

### Deliverables
1. `api/config/board-config.yaml` — the Mindspace board configuration (first instance)
2. This PDSA document — schema specification for the dev task

### Next Step
`ux-kanban-config-driven` (dev task) implements:
1. API endpoint to serve board-config.yaml (or inline fetch)
2. kanban.js refactor to read config at init
3. Replace all hardcoded values with config lookups

### Validation Criteria
1. Schema has all 8 sections: board, statuses, roles, columns, filters, card, detail, actions
2. All 11 statuses defined with label, color, terminal flag
3. All 4 roles defined with label, color
4. 7 columns covering all 11 statuses (no gaps, no overlaps)
5. 5 filter options matching D1 decision
6. Detail panel sections match current kanban.js layout
7. `cancelled` in `done` column (D5)
8. No overlap with workflow.yaml (rendering only, no transitions/gates)
