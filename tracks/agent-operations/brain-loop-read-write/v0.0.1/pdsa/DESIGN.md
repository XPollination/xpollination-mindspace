# PDSA: Brain Read-Write Loop — Mandatory Per-Turn

**Task:** `brain-loop-read-write-mandatory`
**Date:** 2026-03-04
**Status:** Design

## Plan

Complete the brain read-write loop so every agent turn queries brain (read) AND contributes conclusions (write).

### Current State (Evaluated)

| Step | Description | Status |
|------|-------------|--------|
| 1 | User prompt triggers `UserPromptSubmit` hook | WORKING |
| 2 | Hook queries brain with pheromone reinforcement | WORKING — `read_only:true` still triggers retrieval reinforcement (+0.05) in `thoughtspace.js retrieve()` |
| 3 | Brain context injected as `additionalContext` | WORKING — top-3 sources + top-3 highways |
| 4 | Agent processes prompt with brain context | WORKING |
| 5 | Write-back: contribute conclusions before responding | **MISSING** |
| 6 | Response delivered to user | WORKING |

### Key Finding: `read_only:true` Is Correct

The `read_only` flag in `brain-first-hook.sh` controls whether the query itself gets stored as a thought — NOT whether pheromone reinforcement happens. Retrieval reinforcement (+0.05) runs in `retrieve()` regardless. Changing to `read_only:false` would store every prompt as a thought, creating noise. **No change needed.**

Bonus: once the Stop hook contributes in the same session, `applyImplicitFeedback()` will fire (+0.02 to previously-retrieved thoughts), completing the full pheromone cycle automatically.

### Gap: No Write-Back Hook

Claude Code's `Stop` hook fires after every agent response. It receives `last_assistant_message` (full response text) and `stop_hook_active` (loop guard). This is the right insertion point.

## Do — Implementation Design

### New Script: `xpo.claude.brain-writeback-hook.sh`

**Location:** `xpollination-best-practices/scripts/xpo.claude.brain-writeback-hook.sh`

**Logic:**
1. Read stdin JSON → extract `last_assistant_message`, `session_id`, `stop_hook_active`
2. Guard: `stop_hook_active === true` → exit 0 (prevent infinite loops)
3. Guard: message < 100 chars → exit 0 (trivial response, nothing to contribute)
4. Guard: message is pure question → exit 0
5. Brain health check (2s timeout) → if down, exit 0 (soft fail)
6. Extract first 500 chars of response as contribution
7. POST `/api/v1/memory` with `read_only: false`, `thought_category: "agent_conclusion"`, agent role context
8. Exit 0 regardless of POST result

**Hook config addition to `~/.claude/settings.json`:**
```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bash /home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/scripts/xpo.claude.brain-writeback-hook.sh",
        "async": true
      }
    ]
  }
]
```

**Key design decisions:**
- `async: true` — write-back must not delay the user seeing the response
- Soft fail on brain down — never block agent operation for write-back
- `stop_hook_active` guard — prevents hook from re-triggering if another Stop hook blocks

### Pheromone Cycle Completion

With the Stop hook contributing in the same session where brain-first-hook queried:
1. `UserPromptSubmit` → brain query → retrieval reinforcement (+0.05)
2. Agent processes → generates response
3. `Stop` → brain contribute → implicit feedback fires (+0.02 on previously-retrieved thoughts)

This creates a full ant-colony optimization loop: read reinforces trails, use-then-contribute boosts useful knowledge further.

## Study — Test Plan

| # | Test | Verify |
|---|------|--------|
| 1 | Agent gives substantive response (>100 chars) | Brain receives contribution with `thought_category=agent_conclusion` |
| 2 | Agent gives short response (<100 chars) | No brain write |
| 3 | Agent gives question-only response | No brain write |
| 4 | Brain API down | Hook exits gracefully, does not block |
| 5 | `stop_hook_active: true` | Hook skips (loop prevention) |
| 6 | Full loop: prompt → read hook → response → write hook | Both hooks fire, pheromone reinforcement + implicit feedback both work |

## Act — Acceptance Criteria Mapping

| Acceptance Criterion | Addressed By |
|---------------------|-------------|
| Evaluate which steps work/missing | Current State table above |
| Design iteration plan | Do section — Stop hook design |
| Read step reinforces pheromone | Finding: already works, no change needed |
| Write step exists | New `brain-writeback-hook.sh` + Stop config |
| Automated test cases | Test plan (6 cases) |
| Regression detection | Tests 4-6 cover failure modes |
