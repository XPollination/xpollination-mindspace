# PDSA: runner-e2e-multiuser

## Plan

E2E test verifying multi-user collaboration: two users with separate runners working on the same project. 3 test cases.

### File
`src/xp0/test/e2e-multiuser.test.ts`

### Test Cases (SD.1–SD.3)

| ID | Test |
|----|------|
| SD.1 | Two runners claim different tasks — Thomas's runner claims task-A (dev), Robin's runner claims task-B (dev). Both succeed, no conflicts. |
| SD.2 | Concurrent claim → lowest CID wins — Both runners attempt to claim same task. One wins (lowest CID), other gets conflict rejection. Winner proceeds. |
| SD.3 | Cross-user review chain — Thomas's dev runner submits, Robin's QA runner reviews. Delegation VCs scope each user correctly. |

### Setup
- Two owner keypairs (Thomas, Robin)
- Two runners with separate delegation VCs
- Shared FileStorageAdapter (same project store)
- Both runners have valid delegation VCs for the project

### Dev Instructions
1. Create `src/xp0/test/e2e-multiuser.test.ts`
2. Setup 2 owners, 2 runners, shared storage
3. Test conflict resolution (lowest CID wins)
4. Verify delegation scope enforcement across users
5. Git add, commit, push
