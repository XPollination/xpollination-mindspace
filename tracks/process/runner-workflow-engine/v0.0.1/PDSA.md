# PDSA: runner-workflow-engine

## Plan

Implement the decentralized workflow engine in `src/xp0/workflow/`. Every peer validates transitions locally — no central authority. This is Step 5 of the TransactionValidator.

### Key Decisions

1. **Rules loaded from data, not hardcoded** — the engine takes a `WorkflowRules` object parsed from WORKFLOW.md. This allows different projects to have different workflow rules.

2. **7 validation checks** — state transition, role consistency, quality gates, rework routing, blocked state, human answer audit trail, approval modes.

3. **Pure function** — `validateWorkflow(twin, previousTwin, rules)` returns `{valid, errors}`. No side effects, no storage.

### File Layout

```
src/xp0/workflow/
  index.ts                    — re-exports
  types.ts                    — WorkflowRules, TransitionRule, QualityGate
  workflow-engine.ts          — validateWorkflow + sub-validators
  workflow-rules.ts           — default rules from WORKFLOW.md v0.0.19
  workflow-engine.test.ts     — tests for all 7 checks
```

### Types

```typescript
// src/xp0/workflow/types.ts

interface TransitionRule {
  from: string;           // status (e.g., "ready")
  to: string;             // target status (e.g., "active")
  fromRole?: string;      // role required in from state
  toRole?: string;        // role set in to state
  actor: string;          // who can trigger (pdsa, dev, qa, liaison, human, system)
  requiresHumanConfirm?: boolean;
  qualityGates?: string[];  // required DNA fields
}

interface WorkflowRules {
  transitions: TransitionRule[];
  fixedRoleStates: Record<string, string>;  // e.g., { complete: "liaison", approval: "liaison" }
  approvalModes: string[];  // ["autonomous", "semi", "manual"]
}

interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  transition?: TransitionRule;  // matched rule if valid
}
```

### Validation Checks

```typescript
// src/xp0/workflow/workflow-engine.ts

validateWorkflow(
  twin: Twin,              // new version
  previousTwin: Twin,      // previous version (from chain)
  actor: string,           // who is performing this
  rules: WorkflowRules
): WorkflowValidationResult

// 1. State transition: is from→to in rules.transitions?
// 2. Role consistency: does fromRole match previous twin's role?
// 3. Fixed-role states: does toRole match fixedRoleStates[to]?
// 4. Quality gates: are required DNA fields present in twin.content?
// 5. Rework routing: if to=rework, is rework_target_role set?
// 6. Blocked state: if to=blocked, are blocked_from_state + blocked_from_role set?
// 7. Human answer: if requiresHumanConfirm, are human_answer + human_answer_at + approval_mode set?
```

### Default Rules (from WORKFLOW.md v0.0.19)

Embedded in `workflow-rules.ts` as a TypeScript constant. Key transitions:

| From | To | Actor | Gates |
|------|-----|-------|-------|
| pending | ready | liaison | — |
| ready | active | role-match | memory_query_session |
| active | approval | pdsa | pdsa_ref, memory_contribution_id |
| approval | approved | liaison | human_answer, approval_mode |
| approved | testing | qa | — |
| testing | ready | qa | — |
| active | review | dev | — |
| review | review | qa/pdsa | — (same-state role change) |
| review | complete | liaison | human_answer |
| review | rework | qa/pdsa/liaison | rework_target_role |
| complete | rework | human | rework_target_role |
| * | blocked | any | blocked_from_state, blocked_from_role |
| blocked | * | any | — (restores blocked_from_state) |

### Acceptance Criteria Mapping

| Criterion | Test |
|-----------|------|
| Valid transition accepted | ready→active with correct role → valid |
| Invalid transition rejected | ready→complete → error |
| Role consistency enforced | ready+dev → active with wrong actor → error |
| Quality gates enforced | active→approval without pdsa_ref → error |
| Rework routing enforced | review→rework without rework_target_role → error |
| Blocked state preserved | Block stores from_state+from_role, unblock restores |
| Human answer required | approval→approved without human_answer → error |
| Same-state review chain | review+qa → review+pdsa → review+liaison works |

### Dev Instructions

1. Create `types.ts` with interfaces
2. Create `workflow-rules.ts` with default rules from WORKFLOW.md
3. Create `workflow-engine.ts` with 7 validation checks
4. Create `workflow-engine.test.ts`
5. Update `src/xp0/workflow/index.ts`
6. Run tests, git add/commit/push

### Dependencies

- `src/xp0/twin/` — Twin types
- No npm deps — pure logic

### What NOT To Do

- Do NOT store state (engine is stateless validator)
- Do NOT emit events (that's the EventBus concern)
- Do NOT implement approval mode enforcement beyond validation (that's liaison behavior)
- Do NOT hardcode transitions in the validator — accept rules as parameter

## Study / Act

(Populated after implementation)
