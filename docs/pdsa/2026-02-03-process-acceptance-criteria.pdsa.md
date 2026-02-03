# PDSA: Design Must Include Acceptance Criteria

**Date:** 2026-02-03
**Node:** process-acceptance-criteria (ACTIVE)
**Type:** Process Improvement / Reflection

## PLAN

### Incident Analysis
The `viz-structure-fix` design document lacked explicit acceptance criteria. When the Dev agent implemented the changes, the implementation did not work correctly because:
1. Dev had no clear "done" definition
2. No testable criteria to verify against
3. Ambiguous requirements led to incorrect interpretation

### Problem Statement
PDSA documents without acceptance criteria create ambiguity that cascades to:
- Dev implementing wrong behavior
- QA unable to objectively test
- Multiple iterations needed to converge

### Root Cause
- PDSA agent (me) did not consistently include acceptance criteria in all design documents
- Some designs had criteria embedded in prose, not as explicit checkboxes
- No template enforcement

### Solution Design

#### Mandatory PDSA Structure
Every design PDSA MUST include:

```markdown
## Acceptance Criteria
- [ ] Criterion 1 (testable statement)
- [ ] Criterion 2 (testable statement)
- [ ] ...
```

Criteria must be:
1. **Testable** - Can be verified programmatically or visually
2. **Specific** - No ambiguous terms like "improved" or "better"
3. **Complete** - Cover all expected behaviors
4. **Independent** - Each criterion verifiable on its own

#### Bad vs Good Criteria

| BAD (Ambiguous) | GOOD (Testable) |
|-----------------|-----------------|
| "Visualization should look better" | "Stations labeled: Requirements, Designs, Tasks, Tests" |
| "Improve the layout" | "Packages grouped by type, not status" |
| "Add dual links" | "Clicking parent link updates detail panel to parent node" |
| "Works correctly" | "curl returns 200 OK with valid HTML" |

#### Quality Gate for Design Completion
Before marking a design node `completed`, PDSA agent MUST verify:
1. `## Acceptance Criteria` section exists
2. At least 3 testable criteria listed
3. Each criterion is a checkbox `- [ ]`
4. No ambiguous terms

### Checklist for PDSA Agent

Before completing any design:
```
□ Does the PDSA have an "Acceptance Criteria" section?
□ Are there at least 3 criteria?
□ Is each criterion testable (yes/no answer possible)?
□ Are criteria specific (no "better", "improved", "works")?
□ Can Dev implement without asking clarifying questions?
□ Can QA test without interpretation?
```

## DO

### Process Update Applied
From this point forward, all design PDSAs will:
1. Include explicit `## Acceptance Criteria` section
2. Use checkbox format `- [ ]` for each criterion
3. Ensure criteria are testable and specific
4. Be reviewed against the checklist before completion

### Retroactive Review
Existing design PDSAs created today should be audited:
- `viz-design` - Has criteria ✓
- `viz-structure-redesign` - Has criteria ✓
- `viz-dual-links` - Has criteria ✓
- Process PDSAs - N/A (not implementation designs)

## STUDY

### Failure Cost Analysis
When acceptance criteria are missing:
- Dev implements based on description alone → ambiguity
- Implementation may miss requirements → rework
- QA cannot objectively verify → subjective testing
- Multiple iterations needed → time waste

When acceptance criteria are present:
- Dev has clear targets → correct implementation
- QA has verification checklist → objective testing
- Single iteration possible → efficiency

### Lesson Learned
> "A design without acceptance criteria is not a design—it's a wish."

## ACT

### Process Update for CLAUDE.md

Add to PDSA Agent responsibilities:
```markdown
### Design Document Requirements
Every design PDSA MUST include:
- `## Acceptance Criteria` section
- At least 3 testable criteria as checkboxes
- No ambiguous terms (better, improved, works)
- Each criterion answerable with yes/no

Before completing design node, verify:
□ Acceptance criteria section exists
□ Criteria are testable and specific
□ Dev can implement without clarifying questions
□ QA can test without interpretation
```

### Immediate Action
This design document itself demonstrates the requirement by including explicit acceptance criteria in the structure definition above.
