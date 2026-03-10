# PDSA: Brain API — read_only queries leak as stored thoughts

**Task:** brain-query-echo-leak
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The brain fills up with noise entries like "TASK START or TASK BLOCKED markers for LIAISON agent — any interrupted or in-progress tasks". These are the verbatim query strings from the monitor skill's recovery queries, stored as thoughts instead of being discarded.

When agents query for recovery, they get back their own questions instead of actual knowledge.

## Investigation

### API-level read_only enforcement: WORKING

The POST `/api/v1/memory` endpoint in `xpollination-best-practices/api/src/routes/memory.ts` line 199:

```typescript
const thresholdMet = !read_only && (isExplicitIteration || meetsContributionThreshold(prompt.trim()));
```

When `read_only: true`, `thresholdMet` is forced to `false`. The `think()` function (which calls `client.upsert()` on Qdrant) is ONLY called when `thresholdMet === true`. No bypass paths exist.

**Previous fix `brain-pollution-read-only` was deployed and validated 2026-02-27.**

### Hook scripts: ALL pass read_only:true

| Caller | read_only | Status |
|--------|-----------|--------|
| brain-first-hook.sh | `true` | Correct |
| compact-recover.sh | `true` | Correct |
| brain-writeback-hook.sh | omitted (intentional contribution) | Correct |
| monitor skill recovery queries (template) | `true` | Correct |

### Evidence of leak

Querying the brain for "TASK START or TASK BLOCKED markers for LIAISON agent" returns 5+ results:
- 3 categorized as `noise`
- 2 categorized as `state_snapshot`
- 1 with `keyword_echo` quality flag

These are the EXACT query strings from the monitor skill's Query 3 template.

### Root cause: Agents reconstruct curl commands without read_only

The monitor skill provides curl templates with `read_only: true`, but agents are LLMs that **interpret** templates, not execute them literally. Common failure modes:

1. **Agent modifies the curl** — adds parameters, changes the prompt, forgets `read_only`
2. **Agent uses the MCP tool** (`/brain query "..."`) — need to verify the brain skill enforces read_only for queries
3. **Agent constructs ad-hoc curl** during task work — no template enforcement
4. **After context compaction** — agent reconstructs curl from memory, omits `read_only`

The API trusts callers to set `read_only: true`. There is no server-side defense against callers who forget it.

### interface-cli.js contributeToBrain: NOT a leak

The `contributeToBrain()` function at line 322 intentionally omits `read_only` — these are legitimate transition markers, not query leaks. However, they do contribute to brain noise over time (addressed by gardening, not this fix).

## Design

### Change A: Server-side query pattern detection

Add a defensive check in `memory.ts` that auto-forces `read_only: true` when the prompt matches known query patterns, regardless of what the caller sends.

**File:** `xpollination-best-practices/api/src/routes/memory.ts`

```typescript
// After extracting read_only from request, before threshold check:
const QUERY_PATTERNS = [
  /^recovery protocol/i,
  /^current task state/i,
  /^TASK START or TASK BLOCKED markers/i,
  /\bany interrupted or in-progress\b/i,
  /\bwhat are my responsibilities\b/i,
  /\brecovery after context compaction\b/i,
];

const isQueryPattern = QUERY_PATTERNS.some(p => p.test(prompt.trim()));
const effectiveReadOnly = read_only || isQueryPattern;
```

Then use `effectiveReadOnly` instead of `read_only` in the threshold check:

```typescript
const thresholdMet = !effectiveReadOnly && (isExplicitIteration || meetsContributionThreshold(prompt.trim()));
```

**Design rationale:** Defense in depth. The API already has `meetsContributionThreshold()` which checks for declarative, >50-char contributions. But questions can be long and declarative-sounding. Pattern matching on known recovery query strings provides an additional layer that catches agent mistakes.

### Change B: Brain skill query enforcement

Verify that the `/brain query "..."` skill invocation passes `read_only: true`. If the skill file doesn't enforce this, add it.

**File:** `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.brain/SKILL.md`

Check that the query path includes `"read_only": true` in the curl command.

### Change C: Cleanup existing noise

One-time cleanup: delete the leaked query thoughts from Qdrant. These can be identified by:
- `thought_category: "noise"` or `"state_snapshot"`
- Content matching the recovery query templates verbatim
- `quality_flags` containing `keyword_echo`

**Script:** `scripts/brain-cleanup-query-leaks.js`

```javascript
// Qdrant scroll + delete for thoughts matching:
// - content contains "TASK START or TASK BLOCKED markers for"
// - OR content contains "any interrupted or in-progress tasks"
// - OR thought_category === "noise" AND contributor matches agent patterns
```

## Files Changed

1. `api/src/routes/memory.ts` — query pattern detection + auto-force read_only
2. `.claude/skills/xpo.claude.mindspace.brain/SKILL.md` — verify/fix query read_only
3. `scripts/brain-cleanup-query-leaks.js` — one-time cleanup script

**Project:** xpollination-best-practices (brain API lives here, not xpollination-mcp-server)

## Testing

1. Send query with read_only:true — NOT stored (existing behavior, regression test)
2. Send query WITHOUT read_only that matches QUERY_PATTERNS — NOT stored (new behavior)
3. Send legitimate contribution that doesn't match patterns — stored normally
4. Send refine/consolidate with matching pattern — still allowed (explicit iteration overrides)
5. Cleanup script removes known noise entries
6. Brain skill `/brain query` passes read_only:true
7. After cleanup, recovery queries return actual knowledge, not echo of own questions
