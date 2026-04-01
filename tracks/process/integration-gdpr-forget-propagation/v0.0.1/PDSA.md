# PDSA: integration-gdpr-forget-propagation

## Plan

When a peer forgets a twin (GDPR), announce via transport so all peers also forget.

### Changes

**File:** `src/xp0/node/mindspace-node.ts`

```typescript
async forgetTwin(cid: string): Promise<void> {
  await this.storage.forget(cid);  // local purge
  // Announce to network
  this.transport.publish('xp0/system/forget', { cid, forgottenAt: new Date().toISOString() });
}
```

**Also in `start()`** — subscribe to forget announcements:
```typescript
this.transport.subscribe('xp0/system/forget', async (msg) => {
  if (msg.cid) await this.storage.forget(msg.cid);
});
```

### Acceptance Criteria
1. Node A forgets → Node B receives announcement and forgets too
2. Forgotten twin content purged on all peers
3. CID marker preserved (chain doesn't break)
4. Forget propagates even if twin doesn't exist locally (no-op)

### Dev Instructions
1. Add `forgetTwin()` to MindspaceNode
2. Subscribe to `xp0/system/forget` in `start()`
3. Test with 2 nodes
