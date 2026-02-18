# PDSA: Visualization Structure Redesign

**Date:** 2026-02-03
**Node:** viz-structure-design (ACTIVE)
**Type:** Design

## PLAN

### Problem Statement
Current visualization structure is **WRONG**:
- Stations = Statuses (pending, ready, active, done)
- This shows workflow state, not conceptual structure

Correct structure should be:
- Stations = Types (requirement, design, task, test)
- Status = property shown on each package (color/badge)

### Current Architecture (Wrong)
```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ PENDING │  │  READY  │  │ ACTIVE  │  │  DONE   │
│ Station │  │ Station │  │ Station │  │ Station │
│ [pkg]   │  │ [pkg]   │  │ [pkg]   │  │ [pkg]   │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```

### Proposed Architecture (Correct)
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ REQUIREMENTS │  │   DESIGNS    │  │    TASKS     │  │    TESTS     │
│   Station    │  │   Station    │  │   Station    │  │   Station    │
│              │  │              │  │              │  │              │
│ [●] req-1    │  │ [●] des-1    │  │ [○] task-1   │  │ [○] test-1   │
│ [●] req-2    │  │ [○] des-2    │  │ [●] task-2   │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                    ↑                    ↑
           ← DAG dependency arrows →

Legend: ● = completed/done, ○ = pending/active
```

### Design Changes

1. **Station Layout**
   - 4 columns: Requirement, Design, Task, Test
   - Group packages by `type` field, not `status`

2. **Package Rendering**
   - Color indicates `status`:
     - Gray: pending
     - Blue: ready
     - Green: active
     - Teal: done/completed
   - Type icon removed (redundant with station)
   - Show meaningful title from `dna.title` instead of slug

3. **Detail Panel**
   - Show full `dna.title`
   - Show slug as secondary identifier
   - Show `dna.description`
   - List acceptance criteria if present
   - Show dual-links (parent relationships)

4. **DAG Dependencies**
   - Arrows now typically flow left→right (req→design→task→test)
   - Cross-type dependencies visible
   - Arrows should be more prominent

### File Changes

| File | Change |
|------|--------|
| `viz/index.html` | Refactor `renderStations()`, `renderPackages()`, update colors |

### Acceptance Criteria
- [ ] Stations labeled: Requirements, Designs, Tasks, Tests
- [ ] Packages grouped by type, not status
- [ ] Status shown as color on package
- [ ] Package labels show `dna.title` (truncated)
- [ ] Detail panel shows full title, description, criteria
- [ ] DAG arrows flow left→right between types

## DO

### Handoff to Dev Agent
After this PDSA is approved, create task node for Dev to implement:
- Refactor `viz/index.html` per design above
- Test with current 13 nodes

**Note:** Per role boundary rules, I will NOT create the task node.
Orchestrator will create `viz-structure-impl` task after reviewing this design.

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-viz-structure-redesign.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-viz-structure-redesign.pdsa.md
