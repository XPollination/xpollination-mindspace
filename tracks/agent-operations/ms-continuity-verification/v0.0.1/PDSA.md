# PDSA: Agent Continuity Verification — Restart Simulation

**Task:** ms-continuity-verification
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.14 Phase 0.4

## Problem

Recovery endpoint, working memory push, and brain hygiene are wired but never tested end-to-end. Need to verify the complete cycle: push state → lose context → recover → verify correct state — under 30 seconds.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Test scenario: push working state, simulate restart, verify recovery | Full cycle validation |
| D2 | Recovery time target: < 30 seconds from /xpo.claude.monitor to self-test | Performance AC from original task |
| D3 | Test graceful degradation: brain down → fallback to PM system scan | Must not fail catastrophically |
| D4 | Test null working_state → key_context orientation | Idle agent recovery path |
| D5 | Automated test script (not manual) | Reproducible, can run in CI |

### Test Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| T1 | Active task recovery | Push state → GET recovery → verify task_slug, step, human_expectation | Correct state returned |
| T2 | Recovery time | Time from monitor start to self-test output | < 30 seconds |
| T3 | Brain down fallback | Stop brain → run monitor → verify fallback path | Uses PM system scan, no crash |
| T4 | Null working state | Clear working memory → GET recovery → verify key_context used | Orientation from context, not error |
| T5 | Self-test presentation | Full monitor flow → verify self-test text includes role, task, step | All fields present |

### Acceptance Criteria

- AC1: Active task recovery returns correct working_state fields
- AC2: Recovery completes in < 30 seconds
- AC3: Brain-down scenario falls back gracefully (no crash, uses PM scan)
- AC4: Null working_state uses key_context for orientation
- AC5: Self-test text includes role, task_slug, step, human_expectation
- AC6: Test is automated and reproducible

### Files to Create

- `tests/continuity/recovery-simulation.test.ts` — Automated recovery test suite

### Test Plan

Run the test suite — it IS the verification.

## Do

(QA/DEV implements the test suite and runs it)

## Study

(Results analysis — timing, correctness, failure modes)

## Act

(Tune recovery if > 30s, fix any failure paths)
