# PDSA: runner-e2e-security

## Plan

10 automated E2E security tests verifying all threat mitigations from the runner architecture.

### File
`src/xp0/test/e2e-security.test.ts`

### Test Cases

| ID | Threat | Test |
|----|--------|------|
| T-SEC-1 | Rogue runner | No delegation VC → Step 3 rejects claim |
| T-SEC-2 | Impersonation | Wrong signing key → Step 2 rejects |
| T-SEC-3 | Tampered twin | Modified content, old CID → Step 1 rejects |
| T-SEC-4 | Expired delegation | Past validUntil → Step 3 rejects |
| T-SEC-5 | Scope violation | VC allows dev role, attempts liaison action → rejected |
| T-SEC-6 | Revoked delegation | Tombstoned VC → Step 3 rejects |
| T-SEC-7 | Replay attack | Resubmit old challenge response → timestamp check rejects |
| T-SEC-8 | Chain tampering | Modified previousVersion CID → Step 4 rejects |
| T-SEC-9 | Workflow skip | active→complete skipping review → Step 5 rejects |
| T-SEC-10 | Conflict manipulation | Attempt to force non-lowest CID as winner → Step 6 rejects |

### Setup per test
1. Create FileStorageAdapter in temp dir
2. Generate keypairs (owner + attacker + runner)
3. Create delegation VCs as needed
4. Attempt the attack
5. Assert rejection with specific error

### Dev Instructions
1. Create `src/xp0/test/e2e-security.test.ts` with all 10 tests
2. Each test is self-contained (own storage, own keys)
3. Run `npx vitest run src/xp0/test/e2e-security.test.ts`
4. Git add, commit, push

### What NOT To Do
- Do NOT test network-level attacks (these are protocol-level tests)
- Do NOT implement mitigations (they already exist in the modules)
