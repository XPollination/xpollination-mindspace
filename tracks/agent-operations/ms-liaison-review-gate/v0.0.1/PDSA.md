# PDSA: LIAISON Review Hard Gate — Documented Reasoning

**Task:** ms-liaison-review-gate
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.18 Phase 1.9

## Problem

LIAISON in auto mode rubber-stamps approvals without reading DNA or challenging team work. Auto mode means no human wait, NOT no review. Approvals are a black box — no trail of what was checked or why.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | New DNA field `liaison_review` (object: decision, reasoning, challenges, next_action) | Structured review data, not free text |
| D2 | Required on: approval→approved, review→complete, review→rework (actor=liaison) | All liaison decision transitions |
| D3 | Workflow engine gate: reject transitions without `liaison_review` when actor=liaison | Enforcement — can't skip review |
| D4 | Gate message instructs: "Document your reasoning. What did you check? What did you challenge?" | Guides the agent to produce quality reviews |
| D5 | Git-tracked review file: tracks/{group}/{slug}/v{version}/liaison-review.md | Permanent, traversable review trail |
| D6 | SKILL.md update: review protocol (read DNA, verify QA+PDSA reviews, check test counts, note concerns) | Procedural guidance for LIAISON agent |
| D7 | Viz display: liaison_review shown in Object Detail panel | Thomas can see exactly what LIAISON considered |

### liaison_review Schema

```json
{
  "decision": "approved|completed|rework",
  "reasoning": "Why this decision — references specific DNA content",
  "dna_fields_checked": ["qa_review", "pdsa_review", "test_pass_count", "implementation"],
  "test_coverage_assessment": "20/20 tests, covers all ACs",
  "design_match_assessment": "Implementation matches PDSA D1-D7",
  "challenges": "None — or list of concerns raised",
  "next_action": "Forward to dev for implementation"
}
```

### Acceptance Criteria

- AC1: `liaison_review` field required on approval→approved, review→complete, review→rework
- AC2: Workflow engine rejects liaison transitions without `liaison_review`
- AC3: Gate message provides review guidance
- AC4: liaison_review must contain `decision` and `reasoning` at minimum
- AC5: Git-tracked review file created at tracks/{group}/{slug}/liaison-review.md
- AC6: SKILL.md includes review protocol steps
- AC7: Viz Object Detail shows liaison_review content

### Files to Change

- `src/db/workflow-engine.js` — Add `liaison_review` to requiresDna for liaison transitions
- `~/.claude/skills/xpo.claude.monitor/SKILL.md` — Add LIAISON review protocol
- `viz/versions/v0.0.X/index.html` — Add liaison_review rendering in detail panel
- `viz/server.js` — Add `liaison_review` to LITE_FIELDS (or full DNA on detail)

### Test Plan

1. Attempt review→complete as liaison without liaison_review → blocked
2. Add liaison_review with decision+reasoning → transition succeeds
3. Attempt approval→approved without liaison_review → blocked
4. Verify Viz shows liaison_review in detail panel
5. Verify review file committed to git

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
