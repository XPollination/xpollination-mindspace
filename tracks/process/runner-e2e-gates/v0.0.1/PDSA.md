# PDSA: runner-e2e-gates

## Plan

E2E test verifying quality gates reject invalid workflow transitions. 4 test cases using the full validation stack (twin kernel + workflow engine + transaction validator).

### File Layout

```
src/xp0/test/
  e2e-gates.test.ts    — 4 test cases (SE.1–SE.4)
```

### Test Setup

Each test:
1. Creates a FileStorageAdapter in a temp directory
2. Creates keypairs for owner + runner
3. Creates delegation VC
4. Creates a task twin at the starting state
5. Attempts an invalid evolution
6. Asserts the transaction validator rejects it with specific error

### Test Cases

**SE.1: Missing pdsa_ref blocks active→approval**
```typescript
// Create task twin at active+pdsa
// Evolve to approval WITHOUT setting pdsa_ref in DNA
// Run validate() → expect step 5 (workflow) to reject
// Assert error contains "pdsa_ref"
```

**SE.2: Missing abstract_ref blocks review→complete**
```typescript
// Create task twin at review+liaison
// Evolve to complete WITHOUT abstract_ref
// Run validate() → expect rejection
// Assert error contains "abstract_ref" or "human_answer"
```

**SE.3: Invalid transition active→complete rejected**
```typescript
// Create task twin at active+dev
// Evolve directly to complete (skipping review chain)
// Run validate() → expect step 5 to reject
// Assert error contains "transition not allowed"
```

**SE.4: Role consistency enforced**
```typescript
// Create task twin at review+liaison, attempt complete+dev
// Run validate() → expect rejection
// Assert error contains "role" or "consistency"
```

### Dependencies

- `src/xp0/twin/` — create, sign, evolve
- `src/xp0/auth/` — keypair generation, delegation VC
- `src/xp0/storage/` — FileStorageAdapter
- `src/xp0/validation/` — TransactionValidator (full 6-step)
- `src/xp0/workflow/` — workflow rules + engine

### Dev Instructions

1. Create `src/xp0/test/e2e-gates.test.ts`
2. Import all modules, set up storage + auth per test
3. Implement 4 test cases per spec
4. Run `npx vitest run src/xp0/test/e2e-gates.test.ts`
5. Git add, commit, push

### What NOT To Do

- Do NOT test valid transitions (that's e2e-happy-path)
- Do NOT use real Claude Code (quality gates are validated pre-execution)
- Do NOT test network scenarios (single peer only)

## Study / Act

(Populated after implementation)
