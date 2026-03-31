# PDSA: runner-libp2p-transport

## Plan

Implement the P2P transport layer in `src/xp0/transport/`. This is Phase 2 — replaces git as the sync mechanism between Mindspace peers. Enables decentralized task claiming and twin sync.

### Key Decisions

1. **TransportAdapter interface first** — define the interface, then implement LibP2PTransport. Phase 1 already has HTTPTransport (via existing A2A). This task adds the P2P implementation.

2. **libp2p as a library** — use `@libp2p/libp2p` with pluggable transports (TCP, WebSocket), GossipSub for pub/sub, Bitswap for content exchange, DHT for discovery.

3. **Project room scoping** — each project gets its own GossipSub topic: `xp0/{project}/events`. Runners subscribe only to their project topics.

4. **Offline queue** — when disconnected, twin evolutions queue locally. On reconnect, replay queue to mesh.

### File Layout

```
src/xp0/transport/
  index.ts                  — re-exports
  types.ts                  — TransportAdapter, PeerInfo, TransportEvent
  libp2p-transport.ts       — LibP2PTransport implementation
  offline-queue.ts          — OfflineQueue for disconnected operation
  libp2p-transport.test.ts  — integration tests (local peers)
```

### Types

```typescript
// src/xp0/transport/types.ts

interface TransportAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Pub/Sub
  publish(topic: string, twin: Twin): Promise<void>;
  subscribe(topic: string, handler: (twin: Twin) => void): void;
  unsubscribe(topic: string): void;
  
  // Content Exchange
  fetch(peerId: string, cid: string): Promise<Twin | null>;
  provide(twin: Twin): Promise<void>;
  
  // Discovery
  discover(): AsyncIterable<PeerInfo>;
  peers(): PeerInfo[];
  
  // Status
  isConnected(): boolean;
  localPeerId(): string;
}

interface PeerInfo {
  peerId: string;
  multiaddrs: string[];
  projects: string[];
  lastSeen: string;  // ISO 8601
}

interface TransportEvent {
  type: 'twin-announced' | 'peer-joined' | 'peer-left' | 'connected' | 'disconnected';
  topic?: string;
  twin?: Twin;
  peer?: PeerInfo;
  timestamp: string;
}
```

### LibP2P Configuration

```typescript
// src/xp0/transport/libp2p-transport.ts

const node = await createLibp2p({
  transports: [tcp(), webSockets()],
  streamMuxers: [yamux()],
  connectionEncryption: [noise()],
  services: {
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    dht: kadDHT(),
    identify: identify(),
  },
  peerDiscovery: [
    mdns(),           // local network discovery
    bootstrap({...}), // known peers for bootstrap
  ],
});
```

### GossipSub Topics

| Topic | Purpose |
|-------|---------|
| `xp0/{project}/events` | Twin evolution announcements |
| `xp0/{project}/tasks` | Task availability (for claiming) |
| `xp0/{project}/heartbeat` | Runner health signals |

### Offline Queue

```typescript
// src/xp0/transport/offline-queue.ts

class OfflineQueue {
  enqueue(topic: string, twin: Twin): void;
  drain(): AsyncIterable<{topic: string, twin: Twin}>;
  size(): number;
  clear(): void;
}
```
Queue to filesystem (JSON array) for persistence across restarts. On reconnect, drain queue to mesh.

### Dependencies (npm)

- `libp2p` — core library
- `@chainsafe/libp2p-gossipsub` — GossipSub pub/sub
- `@chainsafe/libp2p-noise` — encrypted connections
- `@chainsafe/libp2p-yamux` — stream multiplexing
- `@libp2p/tcp` — TCP transport
- `@libp2p/websockets` — WebSocket transport
- `@libp2p/mdns` — local discovery
- `@libp2p/bootstrap` — bootstrap peers
- `@libp2p/kad-dht` — DHT for content routing
- `@libp2p/identify` — peer identification

### Acceptance Criteria Mapping

| Criterion | Test |
|-----------|------|
| Two peers discover each other | Start 2 local nodes, verify peer list |
| Publish reaches subscriber | Peer A publishes twin, Peer B receives |
| Project scoping works | Peer A subscribes to project-X, Peer B publishes to project-Y → A doesn't receive |
| CID-based fetch works | Peer A provides twin, Peer B fetches by CID |
| Offline queue persists | Disconnect, enqueue 3 twins, reconnect, drain → 3 twins published |
| Heartbeat signals work | Runner publishes heartbeat, peer detects |

### Dev Instructions

1. Install all libp2p dependencies
2. Create `types.ts` with TransportAdapter interface
3. Create `libp2p-transport.ts` implementing all methods
4. Create `offline-queue.ts` for disconnected operation
5. Create tests — use 2 local libp2p nodes with TCP
6. Update `src/xp0/transport/index.ts`
7. Run tests, git add/commit/push

### What NOT To Do

- Do NOT implement Bitswap content exchange (use simple fetch for now)
- Do NOT implement NAT traversal (Circuit Relay) — Phase 3
- Do NOT implement encrypted messaging (noise handles transport encryption)
- Do NOT add relay servers — direct connections only for Phase 2
- Do NOT implement sync strategies (pinning, space-sync) — separate tasks

## Study / Act

(Populated after implementation)
