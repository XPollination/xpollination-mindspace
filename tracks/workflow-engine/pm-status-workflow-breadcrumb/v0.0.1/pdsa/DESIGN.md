# PDSA: PM Status Workflow Breadcrumb — v0.0.1

## PLAN

### Problem

Thomas lost context during PM status review — couldn't tell whether he was approving a design (pre-implementation) or reviewing a completed implementation (post-implementation). The task presentation shows DNA details but NOT where in the pipeline the task currently sits.

### Design

Add a workflow breadcrumb line above each task presentation in PM status Phase 2 drill-down. The breadcrumb shows all pipeline phases with the current phase highlighted.

#### Pipeline Phases (Human-Readable)

Map task `status+role` to a named phase:

| Status | Role | Phase Name |
|--------|------|-----------|
| pending, ready | pdsa | DESIGN QUEUE |
| active | pdsa | DESIGNING |
| approval | liaison | APPROVAL |
| approved, testing | qa | TESTING |
| ready, active | dev | IMPLEMENTING |
| review | qa | QA REVIEW |
| review | pdsa | PDSA REVIEW |
| review | liaison | HUMAN REVIEW |
| rework | any | REWORK |
| complete | any | COMPLETE |
| blocked | any | BLOCKED |

#### Breadcrumb Format

```
DESIGN QUEUE > DESIGNING > [APPROVAL] > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE
```

- Current phase wrapped in `[BRACKETS]` and **bolded**
- Past phases shown normally (completed)
- Future phases shown normally (upcoming)
- REWORK shown as a special marker if applicable: `[REWORK → DESIGNING]`

#### Example Output

For a task in `approval+liaison`:
```
DESIGN QUEUE > DESIGNING > **[APPROVAL]** > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE
```

For a task in `review+liaison` (final human review):
```
DESIGN QUEUE > DESIGNING > APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > **[HUMAN REVIEW]** > COMPLETE
```

For a task in rework after PDSA review:
```
DESIGN QUEUE > DESIGNING > APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > **[REWORK]** > PDSA REVIEW > HUMAN REVIEW > COMPLETE
```

### Changes Required

1. **`xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`** (~15 lines):
   - Add breadcrumb generation instruction in Step 3, item 3 (presentation template)
   - Insert breadcrumb line ABOVE the task header (`=== Task N of M ===`)
   - Include the phase mapping table
   - Instruct LIAISON to determine current phase from `status+role`

#### Skill File Change (Step 3, item 3 — before the presentation template)

Add after the `Get full DNA` step and before `Present to Thomas`:

```
2b. **Generate workflow breadcrumb:**

   Map the task's current `status+role` to a pipeline phase:

   | Status+Role | Phase |
   |-------------|-------|
   | pending/ready + pdsa | DESIGN QUEUE |
   | active + pdsa | DESIGNING |
   | approval + liaison | APPROVAL |
   | approved/testing + qa | TESTING |
   | ready/active + dev | IMPLEMENTING |
   | review + qa | QA REVIEW |
   | review + pdsa | PDSA REVIEW |
   | review + liaison | HUMAN REVIEW |
   | rework + any | REWORK |
   | complete | COMPLETE |

   Build the breadcrumb line:
   ```
   DESIGN QUEUE > DESIGNING > APPROVAL > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE
   ```
   Wrap the current phase in **bold brackets**: `**[APPROVAL]**`

   For rework: show `**[REWORK]**` in place, indicating the task looped back.
```

And in the presentation template, add the breadcrumb as the first line:

```
   <breadcrumb line>
   === Task N of M: <title> ===
   Type: <task type> | Priority: <priority> | Project: <project>
   ...
```

### What This Does NOT Do

- Does NOT add breadcrumb to the viz UI (that's a separate task)
- Does NOT change the task DNA or workflow engine
- Does NOT add clickable phases (this is text output, not HTML)
- Does NOT change the summary table format (Phase 1)

### Acceptance Criteria

1. Breadcrumb line appears above each task in PM status drill-down
2. Current phase is visually highlighted (bold + brackets)
3. Phases are human-readable (not raw status codes)
4. Breadcrumb accurately maps task status+role to pipeline phase
5. Rework state is clearly indicated
6. Skill file updated with breadcrumb as part of presentation template

## DO

Implementation by DEV agent. ~15 lines added to SKILL.md.

## STUDY

Next PM status run: verify breadcrumb appears, verify current phase matches task status.

## ACT

If approved: consider adding the same breadcrumb to the viz detail panel as a future enhancement.
