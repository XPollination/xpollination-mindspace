# PDSA: runner-e2e-happy-path

## Plan

Full happy path E2E test: task creation → PDSA design → QA test → dev implementation → review chain → completion. 8 test cases in a single integration suite using mock-claude runners.

### File
`src/xp0/test/e2e-happy-path.test.ts`

### Test Cases (SA.1–SA.8)

| Step | Test | What it verifies |
|------|------|-----------------|
| SA.1 | Liaison creates task | Task twin created, state pending→ready+pdsa |
| SA.2 | PDSA designs | PDSA runner claims, produces design, DNA has proposed_design + pdsa_ref |
| SA.3 | Approval gate | Task evolves to approved after liaison approval |
| SA.4 | QA writes tests | QA runner claims approved task, produces test_plan |
| SA.5 | Dev implements | Dev runner claims ready+dev, produces implementation |
| SA.6 | Review chain | review+qa → review+pdsa → review+liaison (3 evolutions) |
| SA.7 | Completion | Liaison completes, task twin state=complete |
| SA.8 | Provenance | Walk history from complete back to genesis — full Merkle-DAG chain intact, every CID verifiable |

### Setup
- FileStorageAdapter in temp dir
- 4 mock-claude runners (liaison, pdsa, qa, dev) with different keypairs
- Delegation VCs scoping each runner to its role
- Default workflow rules from WORKFLOW.md

### Architecture
Single sequential test that builds state across steps. Each SA.n depends on SA.(n-1). Use `describe` blocks with ordered tests.

### Dev Instructions
1. Create `src/xp0/test/e2e-happy-path.test.ts`
2. Setup: create storage, 4 runners, delegation VCs
3. Implement 8 ordered test cases
4. Run `npx vitest run src/xp0/test/e2e-happy-path.test.ts`
5. Git add, commit, push

### What NOT To Do
- Do NOT test failure scenarios (that's e2e-failure)
- Do NOT test rework (that's e2e-rework)
- Do NOT use real Claude Code
