# PDSA: runner-e2e-rework

## Plan

E2E test verifying rework cycle: QA finds issue → dev reworks → re-review → completion. 4 test cases.

### File
`src/xp0/test/e2e-rework.test.ts`

### Test Cases (SB.1–SB.4)

| ID | Test |
|----|------|
| SB.1 | QA sends to rework — review+qa → rework+dev with rework_target_role=dev |
| SB.2 | Dev reclaims — rework+dev → active+dev, implements fix |
| SB.3 | Re-review succeeds — active+dev → review+qa → review+pdsa → review+liaison |
| SB.4 | Completion after rework — review+liaison → complete, history shows rework cycle |

### Setup
- Reuse happy-path setup (storage, runners, VCs)
- Start from review+qa state (after dev submitted)
- QA triggers rework with rework_target_role=dev

### Dev Instructions
1. Create `src/xp0/test/e2e-rework.test.ts`
2. Build on happy-path patterns
3. Verify Merkle-DAG shows full rework cycle in history
4. Git add, commit, push
