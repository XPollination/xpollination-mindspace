# PDSA: integration-reconnection

## Plan

Add auto-reconnection and offline queue drain to LibP2PTransport.

### Changes

**File:** `src/xp0/transport/libp2p-transport.ts`

1. **Connection events** — listen to `peer:disconnect`, attempt reconnect for bootstrap peers with exponential backoff (1s, 2s, 4s, max 30s)
2. **Reconnection loop** — on disconnect, queue reconnection. On success, drain offline queue.
3. **OfflineQueue integration** — already exists (`offline-queue.ts`). Wire: disconnect → queue mode, reconnect → drain.

### Acceptance Criteria
1. Peer reconnects after simulated disconnect
2. Offline queue drains on reconnect
3. Messages published during disconnect are delivered after reconnect
4. Backoff prevents reconnection storms

### Dev Instructions
1. Add `peer:disconnect` listener in `start()`
2. Implement `reconnectWithBackoff(peerId, multiaddr)`
3. On reconnect success, call `offlineQueue.drain()`
4. Test: disconnect peer, publish messages, reconnect, verify delivery
