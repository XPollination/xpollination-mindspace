# PDSA: integration-runner-auto-claim

## Plan

Wire Runner to transport: subscribe to task topics, auto-claim matching tasks, execute, publish results.

### The Gap

Current: `runner.claimTask(twin)` takes a twin as direct argument — nobody calls it.
Required: Runner subscribes to transport, auto-claims tasks matching its role.

### Change

**File:** `src/xp0/node/mindspace-node.ts` (in `addRunner()`)

```typescript
async addRunner(opts: { role: string, autoClaimDelay?: number }): Promise<Runner> {
  const runner = new Runner({ ... });

  // Subscribe to task topics for this runner's role
  this.transport.subscribe(`xp0/project/*/tasks`, async (taskTwin) => {
    // Check: task is ready + role matches
    if (taskTwin.content.status === 'ready' &&
        taskTwin.content.role === opts.role &&
        runner.state === 'ready' &&
        runner.activeTasks < runner.maxConcurrent) {
      // Auto-claim with optional delay (for conflict resolution fairness)
      if (opts.autoClaimDelay) await sleep(opts.autoClaimDelay);
      try {
        await runner.claimTask(taskTwin);
        const result = await runner.executeTask(taskTwin);
        await runner.completeTask(taskTwin, result);
        // Publish result to transport
        this.transport.publish(`xp0/project/*/events`, result.twin);
      } catch (e) {
        // Claim conflict (another runner won) — ignore
      }
    }
  });

  this.runners.push(runner);
  return runner;
}
```

### Key Points
1. **Claim = evolve task twin to active** — existing `claimTask()` does this
2. **Conflict resolution = lowest CID wins** — if two runners claim simultaneously, the one with lower CID wins, the other gets a dock conflict
3. **Execute = call mock-claude** — existing `executeTask()` does this
4. **Publish result = announce to transport** — so other peers see the result

### Runner Needs These Methods

The Runner class needs to expose (add if missing):
- `isListening(): boolean` — whether subscribed to transport
- `getRole(): string` — runner's role
- `getId(): string` — runner ID (CID of runner twin)
- `getStatus(): RunnerState` — current state
- `drain(): Promise<void>` — stop accepting, wait for in-flight
- `getTransport(): undefined` — runner accesses transport through node, not directly

### Acceptance Criteria
1. Runner auto-claims task published to transport (T5.2 fully passes)
2. Two runners for same role — lowest CID wins conflict (T4.3)
3. Drain stops auto-claiming (T1.4)
4. Runner doesn't claim tasks for other roles

### Dev Instructions
1. Update `addRunner()` in mindspace-node.ts with transport subscription
2. Add missing Runner methods (getId, getStatus, drain, isListening, getRole, getTransport)
3. Verify T5.2, T1.4, T4.3 from e2e-integration pass
4. Git add, commit, push
