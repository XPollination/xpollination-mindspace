# PDSA: integration-conflict-resolution

## Plan

Detect and resolve concurrent twin evolutions (heads > 1) using lowest CID wins.

### Design

**File:** `src/xp0/node/mindspace-node.ts`

When docking a twin that creates a conflict (same logicalId, different CIDs):
```typescript
async resolveConflicts(logicalId: string): Promise<string> {
  const heads = await this.storage.heads(logicalId);
  if (heads.length <= 1) return heads[0]; // no conflict
  // Lowest CID wins — deterministic, no coordination
  heads.sort();
  const winner = heads[0];
  // Mark losers as superseded
  for (const loserCid of heads.slice(1)) {
    const loser = await this.storage.resolve(loserCid);
    if (loser) {
      const superseded = await evolve(loser, { state: 'superseded', supersededBy: winner });
      await this.storage.dock(superseded);
    }
  }
  return winner;
}
```

Call after docking any twin that has `previousVersion` set.

### Acceptance Criteria
1. Two concurrent claims → both dock → heads=2 → resolve → heads=1
2. Winner is lowest CID (deterministic)
3. Loser marked superseded
4. All 3 peers agree on same winner (T4.3)

### Dev Instructions
1. Add `resolveConflicts()` to MindspaceNode
2. Call after `dockWithValidation()` when twin has previousVersion
3. Test with T4.2 and T4.3 from e2e-integration
