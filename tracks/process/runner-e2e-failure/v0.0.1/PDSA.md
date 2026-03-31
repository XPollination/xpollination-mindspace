# PDSA: runner-e2e-failure

## Plan

E2E test verifying failure and recovery scenarios. 5 test cases.

### File
`src/xp0/test/e2e-failure.test.ts`

### Test Cases (SC.1–SC.5)

| ID | Test |
|----|------|
| SC.1 | Claude Code timeout — MOCK_CLAUDE_DELAY_MS=60000 + runner timeout=100ms → task stays active, not corrupted |
| SC.2 | Claude Code crash — MOCK_CLAUDE_EXIT_CODE=1 → runner marks task failed, DNA has error details |
| SC.3 | Runner crash recovery — runner stops mid-task → task still active+runner_did, new runner can reclaim |
| SC.4 | Brain unavailable — brain down during contribute → local fallback, runner continues |
| SC.5 | Storage full — dock() fails → runner blocks task with reason, doesn't crash |

### Setup
- Mock-claude with configurable failure modes
- FileStorageAdapter in temp dir
- Single runner per test

### Dev Instructions
1. Create `src/xp0/test/e2e-failure.test.ts`
2. Use MOCK_CLAUDE_EXIT_CODE and MOCK_CLAUDE_DELAY_MS env vars
3. Verify graceful degradation, not crashes
4. Git add, commit, push
