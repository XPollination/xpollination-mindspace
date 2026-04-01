# PDSA: integration-network-security

## Plan

Wire transport twin reception through the 6-step TransactionValidator in MindspaceNode. Invalid twins from the network are dropped before docking.

### Change

**File:** `src/xp0/node/mindspace-node.ts`

In the transport subscription handler (where twins arrive via pub/sub):
```typescript
this.transport.subscribe(topic, async (twin) => {
  const previous = twin.previousVersion
    ? await this.storage.resolve(twin.previousVersion)
    : null;
  try {
    await this.dockWithValidation(twin, previous);
  } catch (e) {
    // Invalid twin — drop silently, log for monitoring
    console.warn(`[MindspaceNode] Rejected twin from network: ${e.message}`);
  }
});
```

`dockWithValidation()` already exists (from `integration-dock-validation`). This task ensures it's used in the transport receive path.

### Test Cases
1. Peer A sends tampered twin → Peer B rejects (Step 1 CID check)
2. Peer A sends unsigned twin → Peer B rejects (Step 2 signature)
3. Peer A sends invalid workflow transition → Peer B rejects (Step 5)
4. Peer A sends valid twin → Peer B accepts and docks

### Acceptance Criteria
1. Invalid twins from transport never enter local storage
2. Valid twins from transport dock normally
3. Rejection is logged (not silent crash)
4. Existing transport tests still pass

### Dev Instructions
1. Ensure `dockWithValidation()` is called in transport subscription
2. Add try/catch for rejection logging
3. Add network-level security tests to e2e-integration or separate test file
4. Git add, commit, push
