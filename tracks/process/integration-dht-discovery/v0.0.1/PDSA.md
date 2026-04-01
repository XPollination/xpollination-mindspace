# PDSA: integration-dht-discovery

## Plan

Replace mDNS (LAN-only) with bootstrap-based peer discovery for cross-network connections.

### Change

**File:** `src/xp0/transport/libp2p-transport.ts`

Current (line ~58):
```typescript
peerDiscovery: [mdns()]
```

New:
```typescript
import { bootstrap } from '@libp2p/bootstrap';

peerDiscovery: opts.bootstrapPeers.length > 0
  ? [bootstrap({ list: opts.bootstrapPeers })]
  : [mdns()]  // fallback for local dev/tests
```

### Key Points
1. **Bootstrap peers from config** — `LibP2PTransport` constructor already accepts `bootstrapPeers: string[]`. Just wire it to `@libp2p/bootstrap`.
2. **Keep mDNS as fallback** — when no bootstrap peers provided (tests), use mDNS for LAN discovery.
3. **Add `@libp2p/bootstrap` dep** — `npm install @libp2p/bootstrap`
4. **MindspaceNode passes bootstrap peers** — already in `MindspaceNodeOpts.bootstrapPeers`.

### Acceptance Criteria
1. Two nodes with bootstrap peer config discover each other (T5.3 passes)
2. Empty bootstrapPeers falls back to mDNS (existing transport tests still pass)
3. Existing 10 transport tests unchanged

### Dev Instructions
1. `npm install @libp2p/bootstrap`
2. Update `libp2p-transport.ts` constructor to accept and use bootstrapPeers
3. Conditional: bootstrap if peers provided, mDNS if not
4. Verify existing transport tests pass
5. Verify e2e-integration T5.3 passes
6. Git add, commit, push
