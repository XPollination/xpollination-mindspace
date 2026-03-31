# PDSA: integration-dock-validation

## Plan

Validate twin evolutions at dock time in MindspaceNode. Invalid evolutions from the network are rejected before entering local storage.

### Change

**File:** `src/xp0/node/mindspace-node.ts`

Add `dockWithValidation()` method:
```typescript
async dockWithValidation(evolved: Twin, previous: Twin | null): Promise<void> {
  if (previous) {
    const result = await validate(evolved, {
      storage: this.storage,
      workflowRules: defaultWorkflowRules,
    });
    if (!result.valid) {
      throw new Error(`Validation failed at step ${result.step}: ${result.errors.join(', ')}`);
    }
  }
  await this.storage.dock(evolved);
}
```

Also wire into transport subscription — when twins arrive via pub/sub, validate before docking:
```typescript
this.transport.subscribe(`xp0/project/${project}/events`, async (twin) => {
  const previous = twin.previousVersion
    ? await this.storage.resolve(twin.previousVersion)
    : null;
  await this.dockWithValidation(twin, previous);
});
```

### Key Points
1. Uses existing `TransactionValidator.validate()` from `src/xp0/validation/`
2. Uses existing `defaultWorkflowRules` from `src/xp0/workflow/`
3. `transitionTask()` already calls `evolveTwin()` — route through `dockWithValidation()`
4. Network-received twins go through same validation

### Acceptance Criteria
1. Invalid twin evolution rejected at dock time (T5.x workflow validation tests pass)
2. Valid evolutions dock normally
3. Network-received invalid twins don't enter storage
4. Existing unit tests still pass

### Dev Instructions
1. Add `dockWithValidation()` to MindspaceNode
2. Wire `transitionTask()` through validation
3. Wire transport subscription through validation
4. Verify e2e-integration tests improve
5. Git add, commit, push
