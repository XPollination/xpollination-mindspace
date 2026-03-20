# PDSA: Release Manager Screen

**Task:** release-manager-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-VKF-003

## Problem

No release management view. Tasks complete but no way to group them into releases, track phases, or trigger releases.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Separate screen at /releases route | Release management is distinct from knowledge browsing. Own route keeps concerns separate. |
| D2 | Search overlay as dropdown (not full page) | Lightweight, doesn't lose context. Type-ahead filter. |
| D3 | Phase grouping with collapsible sections | Clear visual hierarchy. Collapse completed phases. |

### Layout

```
/releases
┌─────────────────────────────────────────┐
│ Release Manager                         │
├─────────────────────────────────────────┤
│ [Search tasks...]        [New Release]  │
│                                         │
│ ▼ Phase 1: Foundation (3/5 complete)    │
│   ☑ cap-auth design                     │
│   ☑ cap-auth tests                      │
│   ☑ cap-auth impl                       │
│   ☐ cap-foundation design               │
│   ☐ cap-foundation tests                │
│                                         │
│ ▶ Phase 2: Object Graph (0/8 complete)  │
│   (collapsed)                           │
│                                         │
│ ─── Backlog (unphased) ───              │
│   ☐ mobile-responsive-design            │
│   ☐ search-bar-design                   │
└─────────────────────────────────────────┘
```

### Data Source

Query mindspace_nodes grouped by `dna.group`. Phase = group. Tasks sorted by dependency order. Status badges (complete/active/pending).

### Release Button

"New Release" → confirmation dialog → creates git tag + changelog entry. Requires all phase tasks complete. Disabled if incomplete tasks.

### Acceptance Criteria

- AC1: /releases route renders release manager
- AC2: Tasks grouped by phase/group
- AC3: Collapsible phase sections
- AC4: Search overlay filters tasks
- AC5: Release button with confirmation
- AC6: Backlog section for unphased tasks

### Test Plan

api/__tests__/release-manager.test.ts
