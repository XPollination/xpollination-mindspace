# PDSA: Completion Documentation Gate

**Date:** 2026-03-02
**Task:** completion-documentation-gate
**Status:** PLAN

## Plan

### Problem
When tasks reach `complete` or `cancelled`, there is no structured record of what happened. PDSAs document the plan, but nothing documents the outcome. DNA has operational fields (`findings`, `dev_findings`, `qa_review`) but no management-level summary. Thomas wants a completion abstract — a short git-tracked document created on every complete/cancelled transition.

### Design

Three deliverables: (1) abstract pattern, (2) documentation living doc, (3) WORKFLOW.md v14.

---

### Deliverable 1: Completion Abstract Pattern

#### Location
Parallel to PDSA directory:
```
tracks/<domain>/<task>/v0.0.1/abstract/YYYY-MM-DD-<slug>.abstract.md
```

Example:
```
tracks/brain-infrastructure/retrieval-scoring-quality/v0.0.1/abstract/2026-03-02-retrieval-scoring-quality.abstract.md
```

#### Format: Completed Tasks

```markdown
# Abstract: <Task Title>

**Date:** YYYY-MM-DD
**Task:** <slug>
**Outcome:** completed

## Summary
1-3 sentences: what was done, why, and the result.

## Key Decisions
- Decision 1: <what was decided and why>
- Decision 2: ...

## Documentation Objects
- [PDSA design](link-to-pdsa) — the plan
- [WORKFLOW.md v14](link) — updated with new gate (if applicable)
- [scoring-config.ts](link) — new file added (if applicable)

## What Changed
| File | Change |
|------|--------|
| `path/to/file` | Brief description |

## Metrics (if applicable)
- Tests: N pass, 0 fail
- Files modified: N
```

#### Format: Cancelled Tasks

```markdown
# Abstract: <Task Title>

**Date:** YYYY-MM-DD
**Task:** <slug>
**Outcome:** cancelled

## Cancellation Reason
1-3 sentences: why the task was cancelled.

## Context
What was attempted before cancellation. What, if anything, was learned.

## Follow-Up
- Any successor tasks or alternative approaches identified.
```

#### DNA Field: `abstract_ref`
Like `pdsa_ref`, the abstract file URL is stored in DNA:
```json
{
  "abstract_ref": "https://github.com/XPollination/best-practices/blob/master/tracks/.../abstract/2026-03-02-task.abstract.md"
}
```

#### Who Writes It
- **For completed tasks:** LIAISON writes the abstract as part of the `review+liaison → complete` transition. LIAISON already reviews all DNA fields before presenting to Thomas — the abstract summarizes that review.
- **For cancelled tasks:** LIAISON writes a shorter abstract before executing `any → cancelled`.

---

### Deliverable 2: Documentation Best Practices Living Doc

#### Location
```
xpollination-mcp-server/tracks/process/context/DOCUMENTATION.md
```

Alongside WORKFLOW.md — same directory, same access pattern.

#### Content

```markdown
# Documentation Best Practices — Living Document

**Last Updated:** 2026-03-02
**Status:** v1

---

## Document Types

| Type | Location | Created By | When | Purpose |
|------|----------|-----------|------|---------|
| PDSA | `tracks/<domain>/<task>/v0.0.1/pdsa/` | PDSA agent | active→approval | Design plan |
| Abstract | `tracks/<domain>/<task>/v0.0.1/abstract/` | LIAISON | review→complete or →cancelled | Outcome summary |
| Living Doc | `tracks/process/context/` | Any (iterated) | As needed | Process documentation |

## Naming Conventions

- PDSA: `YYYY-MM-DD-<slug>.pdsa.md`
- Abstract: `YYYY-MM-DD-<slug>.abstract.md`
- Living docs: `UPPERCASE-NAME.md` (e.g., WORKFLOW.md, DOCUMENTATION.md)

## Writing Abstracts

### Completed Tasks
- Start with a 1-3 sentence summary (management-level, not technical)
- List key decisions (not all decisions — only ones that shaped the outcome)
- Link all documentation objects added or modified
- Include a file change table (what changed, not the diff)
- Add metrics if meaningful (test counts, file counts)

### Cancelled Tasks
- Explain why it was cancelled (scope change? superseded? not needed?)
- Document any partial work or learnings worth preserving
- Link follow-up tasks if the work moves elsewhere

### What NOT to Put in Abstracts
- Full technical details (that's in the PDSA and DNA)
- Copy of the PDSA plan (link to it instead)
- Implementation code or diffs
- DNA field contents (the abstract summarizes DNA, doesn't duplicate it)

## Linking Conventions

- **Git links:** Always use full GitHub URL: `https://github.com/XPollination/<repo>/blob/master/path`
- **Cross-repo links:** Use the same GitHub URL format
- **DNA links:** `pdsa_ref` and `abstract_ref` store GitHub URLs
- **Brain references:** Include thought_id when referencing brain contributions

## Iteration Protocol

This document is a living doc. Any agent can propose changes:
1. Edit the document
2. Update version in header
3. Commit with message: `docs: iterate DOCUMENTATION.md to vN — <what changed>`
4. Push immediately

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-03-02 | v1 | Initial creation — abstract pattern, naming, linking | PDSA |
```

---

### Deliverable 3: WORKFLOW.md v14

#### Changes to WORKFLOW.md

**A. Add `abstract_ref` to completion transitions:**

In the "Key Rules" section or a new "Quality Gates" section:

```markdown
## Quality Gates (DNA Requirements)

| Transition | Required DNA | Purpose |
|------------|-------------|---------|
| ready→active | `memory_query_session` | Agent queried brain before claiming |
| active→approval | `pdsa_ref`, `memory_contribution_id` | Design documented and shared |
| active→review | `memory_contribution_id` | Work shared to brain |
| review→complete | `abstract_ref` | Outcome documented in git |
| any→cancelled | `abstract_ref` | Cancellation documented in git |
| any→blocked | `blocked_reason` | Block reason recorded |
```

**B. Add abstract_ref to the PDSA Design Path table note:**

After line 24 (complete row):
```markdown
**Note:** The `review→complete` transition requires `abstract_ref` in DNA — LIAISON creates the abstract before completing.
```

**C. Add to Change Log:**

```markdown
| 2026-03-02 | v14 | Completion documentation gate: abstract_ref required on review→complete and any→cancelled. New DOCUMENTATION.md living doc. | PDSA |
```

---

### Workflow Engine Changes

#### Change 1: Add `requiresDna` to completion transitions
**File:** `xpollination-mcp-server/src/db/workflow-engine.js`

For task type:
```javascript
'review->complete': {
  allowedActors: ['liaison'],
  newRole: 'liaison',
  requiresHumanConfirm: true,
  requiresDna: ['abstract_ref']  // NEW
},
```

For `any->cancelled`:
```javascript
'any->cancelled': {
  allowedActors: ['liaison', 'system'],
  requiresDna: ['abstract_ref']  // NEW
},
```

For bug type (same pattern):
```javascript
'review->complete': {
  allowedActors: ['liaison'],
  newRole: 'liaison',
  requiresDna: ['abstract_ref']  // NEW
},
'any->cancelled': {
  allowedActors: ['liaison', 'system'],
  requiresDna: ['abstract_ref']  // NEW
},
```

#### Change 2: Validate `abstract_ref` as GitHub URL
**File:** `xpollination-mcp-server/src/db/workflow-engine.js`

In `validateDnaRequirements()`, add validation for `abstract_ref` like existing `pdsa_ref` validation:
```javascript
if (field === 'abstract_ref' && typeof dna[field] === 'string' && !dna[field].startsWith('https://github.com/')) {
  return `dna.abstract_ref must be a GitHub URL (got: ${dna[field]}). Commit and push the abstract first.`;
}
```

---

### Files Modified
| File | Repo | Change |
|------|------|--------|
| `src/db/workflow-engine.js` | xpollination-mcp-server | Add `requiresDna: ['abstract_ref']` to complete and cancelled transitions |
| `tracks/process/context/WORKFLOW.md` | xpollination-mcp-server | v14: Document quality gates table, abstract_ref requirement |
| `tracks/process/context/DOCUMENTATION.md` | xpollination-mcp-server | NEW: Documentation best practices living doc |

### NOT Changed
- interface-cli.js (requiresDna enforcement already works generically)
- Viz server (no UI needed — abstract_ref is just a DNA field)
- Brain API
- PDSA agent workflow (PDSA doesn't write abstracts — LIAISON does)

### Design Questions Answered

**Hard gate vs advisory?** Hard gate. Follows the existing pattern: `pdsa_ref` is hard-gated on active→approval, `memory_contribution_id` is hard-gated on active→review. `abstract_ref` is hard-gated on review→complete and any→cancelled. Consistent enforcement.

**How does the abstract relate to existing DNA fields?** The abstract *summarizes* DNA fields (`findings`, `dev_findings`, `qa_review`) into a management-level document. DNA is operational (what each agent found). The abstract is strategic (what happened and why it matters). The abstract links to DNA implicitly (same task slug) and explicitly (via doc links).

**Naming convention?** `YYYY-MM-DD-<slug>.abstract.md` — same as PDSA but with `.abstract.md` extension. Date prefix enables chronological browsing.

**Cancelled tasks?** Lighter abstract — cancellation reason and context. Same hard gate but less content expected. The `abstract_ref` field is required regardless.

**Who maintains the living doc?** Any agent can iterate. Version tracked in header. Same pattern as WORKFLOW.md.

### Risks
- **LIAISON burden increases** — must create abstract before every completion. Mitigation: abstracts are short (5-10 lines of content). LIAISON already reviews all DNA before presenting to Thomas.
- **Cancelled tasks via `system` actor** — system must set `abstract_ref` before cancelling. Mitigation: system-cancelled tasks are rare (automated health failures). System can write a minimal abstract or we exempt system actor. Decision: exempt `system` from the gate on cancelled (add actor check).
- **Retroactive abstracts** — existing completed tasks have no abstracts. No remediation needed — gate is forward-looking only.

### Edge Case: System-Cancelled Tasks
For `any->cancelled` with `system` actor, the `requiresDna` gate could block automated cancellation. Two options:

**Option A (recommended):** Split the cancelled transition:
```javascript
'any->cancelled': { allowedActors: ['liaison'], requiresDna: ['abstract_ref'] },
'any->cancelled:system': { allowedActors: ['system'] },  // No gate for system
```

**Option B:** Add actor-aware gate logic. More complex, not recommended.

Go with Option A — system gets an ungated path, liaison gets the documented path.

## Do
(To be completed by DEV agent — changes in xpollination-mcp-server repo)

## Study
- review→complete blocked without abstract_ref in DNA
- any→cancelled (by liaison) blocked without abstract_ref
- any→cancelled by system works without abstract_ref
- abstract_ref must be a GitHub URL
- DOCUMENTATION.md exists and is readable
- WORKFLOW.md updated to v14 with quality gates table

## Act
- Monitor: are abstracts being created consistently?
- Iterate DOCUMENTATION.md after first few abstracts — refine template based on actual usage
- Consider: abstract template generator tool (given DNA, produce abstract skeleton)
