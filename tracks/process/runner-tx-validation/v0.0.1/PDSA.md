# PDSA: runner-tx-validation

## Plan

Implement the 6-step transaction validator in `src/xp0/validation/`. Every peer independently verifies twin evolutions — this is the blockchain model without consensus overhead.

### Key Decisions

1. **Each step is an independent function** — composable, testable in isolation. The main `validate()` runs all 6 in sequence, short-circuiting on first failure.

2. **Steps depend on existing modules** — CID from twin kernel, signature from twin kernel, delegation from auth, chain from storage, schemas from schemas module. The validator is a composition layer.

3. **Conflict resolution: lowest CID wins** — deterministic, no coordination needed. When `heads() > 1`, the twin with the lexicographically lowest CID is the winner.

4. **Workflow validation is pluggable** — accepts a workflow rules object (from WORKFLOW.md) that defines valid transitions. Not hardcoded.

### File Layout

```
src/xp0/validation/
  index.ts                    — re-exports
  types.ts                    — ValidationResult, ValidationStep, WorkflowRules
  transaction-validator.ts    — 6-step validate() + individual step functions
  transaction-validator.test.ts — tests for all 6 steps + integration
```

### Types

```typescript
// src/xp0/validation/types.ts

interface ValidationResult {
  valid: boolean;
  step: string;           // which step failed (or "all" if valid)
  errors: string[];
}

interface ValidationStep {
  name: string;
  validate: (twin: Twin, context: ValidationContext) => Promise<ValidationResult>;
}

interface ValidationContext {
  storage: StorageAdapter;           // for chain verification
  delegationStore?: StorageAdapter;  // for delegation VC lookup
  workflowRules?: WorkflowRules;    // for workflow validation
}

interface WorkflowRules {
  validTransitions: Record<string, string[]>;  // state → allowed next states
  rolePermissions: Record<string, string[]>;   // role → allowed operations
  qualityGates?: Record<string, string[]>;     // transition → required DNA fields
}
```

### 6 Validation Steps

```typescript
// src/xp0/validation/transaction-validator.ts

// Step 1: CID Integrity
// Recompute CID from twin content, reject if doesn't match
verifyCID(twin): Promise<ValidationResult>

// Step 2: Signature Verification
// Verify Ed25519 signature using twin kernel's verify()
// Unsigned twins fail this step
verifySignature(twin): Promise<ValidationResult>

// Step 3: Delegation Check
// Lookup delegation VC for twin.owner → verify scope includes
// the operation being performed. Skip if owner is self-signed.
verifyDelegation(twin, context): Promise<ValidationResult>

// Step 4: Merkle-DAG Chain
// If previousVersion set, resolve it from storage, verify it exists
// and its CID matches. Walk chain to detect loops.
verifyChain(twin, context): Promise<ValidationResult>

// Step 5: Workflow Validation
// If workflowRules provided, check state transition is valid
// Check role has permission. Check quality gates met.
verifyWorkflow(twin, context): Promise<ValidationResult>

// Step 6: Conflict Resolution
// If heads(logicalId) > 1, resolve by lowest CID
// Returns valid=true with winner CID, or valid=false if twin is not the winner
resolveConflict(twin, context): Promise<ValidationResult>

// Main validator: runs all 6 steps
validate(twin, context): Promise<ValidationResult>
```

### Acceptance Criteria Mapping

| Criterion | Step | Test |
|-----------|------|------|
| Tampered CID rejected | Step 1 | Modify content, keep old CID → error |
| Unsigned twin rejected | Step 2 | Create unsigned twin → error |
| Wrong signer rejected | Step 2 | Sign with wrong key → error |
| Expired delegation rejected | Step 3 | Past validUntil → error |
| Wrong scope rejected | Step 3 | VC without required operation → error |
| Broken chain detected | Step 4 | Set previousVersion to nonexistent CID → error |
| Chain loops detected | Step 4 | Create circular previousVersion → error |
| Invalid transition rejected | Step 5 | Attempt blocked transition → error |
| Conflict resolved by lowest CID | Step 6 | Create 2 heads, verify lowest wins |
| Full validation passes for valid twin | All | Complete valid twin → all steps pass |

### Dev Instructions

1. Create `src/xp0/validation/types.ts` with interfaces
2. Create `src/xp0/validation/transaction-validator.ts` with 6 step functions + main validate()
3. Create `src/xp0/validation/transaction-validator.test.ts` — use MemoryAdapter-like temp storage
4. Update `src/xp0/validation/index.ts` barrel export
5. Run `npx tsc --noEmit` and `npx vitest run src/xp0/validation/`
6. Git add, commit, push

### Dependencies

- `src/xp0/twin/` — CID verification, signature verification
- `src/xp0/auth/` — delegation verification
- `src/xp0/storage/` — StorageAdapter interface (for chain/conflict resolution)
- No new npm dependencies

### What NOT To Do

- Do NOT implement consensus (no voting, no leader election)
- Do NOT add network calls (validation is local)
- Do NOT hardcode workflow rules (accept as parameter)
- Do NOT implement chain repair (detect broken chains, don't fix them)

## Study / Act

(Populated after implementation)
