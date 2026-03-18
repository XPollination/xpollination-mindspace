# PDSA: Brain Hygiene — Purge Echo Entries, Redirect Precompact

**Task:** ms-brain-hygiene
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.12 Phase 0.3

## Problem

Brain has accumulated echo entries (recovery queries echoed back as thoughts at score 0.70+, same text repeated 3x+ per role). These pollute recovery results. Precompact needs to push to working memory API. Recovery queries should use read_only:true.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Identify echo entries by pattern: "Recovery protocol and role definition for" repeated per role | These are query text stored as thoughts, not actual knowledge |
| D2 | Supersede echo entries via brain API (POST with supersede flag or direct Qdrant update) | Remove pollution without deleting (preserve audit trail) |
| D3 | Verify precompact-save.sh pushes to working memory API | Already addressed in ms-working-memory-push — verify it's deployed |
| D4 | Verify recovery queries use read_only:true | Prevents queries from being stored as new thoughts |
| D5 | Optional: bulk-supersede API endpoint (POST /api/v1/memory/bulk-supersede) | Future hygiene automation — only if simple to add |

### Acceptance Criteria

- AC1: Echo entries identified and counted per role (liaison, pdsa, dev, qa)
- AC2: Echo entries superseded/archived (not polluting recovery results)
- AC3: Precompact script verified to push working memory
- AC4: Recovery queries confirmed using read_only:true
- AC5: Post-hygiene: GET /api/v1/recovery/{agentId} returns meaningful context, not echoes

### Files to Change

- Brain API may need bulk-supersede endpoint (optional)
- Verification of existing scripts (no changes expected if ms-working-memory-push completed)

### Test Plan

1. Query brain for echo patterns → count before
2. Run hygiene (supersede echoes)
3. Query again → count after (should be 0 or near 0)
4. GET /api/v1/recovery/agent-pdsa → verify no echo entries in key_context

## Do

(Implementation — may be script-based or manual API calls)

## Study

(Post-hygiene verification)

## Act

(Lessons learned)
