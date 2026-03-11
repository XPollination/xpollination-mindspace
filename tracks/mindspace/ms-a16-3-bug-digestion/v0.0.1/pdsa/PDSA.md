# PDSA: Agent Bug Digestion Workflow

**Date:** 2026-03-11
**Task:** ms-a16-3-bug-digestion
**Capability:** bug-management
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a16-2-bug-notification (BUG_REPORTED SSE broadcast)

## Plan

### Problem

When a bug is reported, it sits in `open` status until a human triages it. Agent-assisted digestion automates the initial assessment: query brain for related knowledge, check recent feature flag changes, search for similar past bugs. This produces an assessment thought that helps the human triage faster.

### Evidence

1. **Task DNA** — "On BUG_REPORTED: agent queries brain for related thoughts, checks recent flag toggles, searches codebase. Produces assessment brain thought. Updates bug status to digested."
2. **bug-reports.ts** — POST creates bug and broadcasts BUG_REPORTED via SSE.
3. **Feature flags** — PUT /:flagId/toggle exists, could correlate with recent bugs.

### Design

#### REQ-DIGEST-BUG-001: Bug Digestion Endpoint

`POST /api/bugs/:bugId/digest`

Process:
1. Fetch bug details
2. Query brain for related thoughts (bug title + description as query)
3. Query recent feature flag toggles (last 24h)
4. Produce assessment: { related_thoughts[], recent_flags[], severity_assessment, suggested_action }
5. Store assessment as brain thought (`thought_category: 'task_outcome'`, `topic: bug.title`)
6. Update bug status to `digested` (new valid status)
7. Return assessment

#### REQ-DIGEST-BUG-002: Bug Status Extension

Add `digested` to valid bug statuses: `open|investigating|digested|resolved|closed`

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/bug-reports.ts` | UPDATE | Add POST /:bugId/digest, extend status enum |
| 2 | `api/db/migrations/028-bug-digested-status.sql` | CREATE | Extend bug status CHECK constraint (if enforced in schema) |

### NOT Changed

- Bug creation, listing, create-task — unchanged
- BUG_REPORTED broadcast — unchanged
- Feature flag toggle — unchanged (read-only access for digestion)

### Risks

1. **Brain unavailability** — If brain is down, digestion produces partial assessment (no related thoughts). Acceptable: partial is better than none.
2. **Auto-digestion race** — If triggered automatically on BUG_REPORTED, multiple agents could digest simultaneously. v0.0.1 is manual (explicit POST call).

## Do

### File Changes

As described in design. Add digest endpoint that queries brain + recent flags, stores assessment, updates bug status.

## Study

### Test Cases (5)

1. POST /:bugId/digest returns 200 with assessment
2. Bug status updated to 'digested' after successful digestion
3. Assessment includes related_thoughts from brain
4. POST digest on non-existent bug returns 404
5. Assessment stored as brain thought

## Act

- Manual digestion working → future: auto-trigger on BUG_REPORTED SSE event
- Assessment quality → refine brain query strategy based on hit rate
- Future: correlate with git blame for affected code identification
