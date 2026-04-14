# PDSA: integration-mindspace-node

## Plan

Create the MindspaceNode integration class that wires all 20 xp0 modules into a single running process. This is GLUE — no new algorithms, just composition.

### Why This Exists

All modules work in isolation (291 tests). But:
- Runner takes task twins as arguments — nobody delivers tasks via network
- E2E tests create twins manually in one process
- Transport exists but isn't connected to Runner
- MindspaceNode IS the integration that makes the system real

### File Layout

```
src/xp0/node/
  index.ts              — re-exports
  mindspace-node.ts     — MindspaceNode class
```

### Interface (from e2e-integration.test.ts)

```typescript
interface MindspaceNodeOpts {
  storeDir: string;
  owner: string;            // DID
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  listenPort: number;        // 0 = random
  bootstrapPeers: string[];  // multiaddr strings
  mockClaudeBinary: string;  // path to claude binary
}

class MindspaceNode {
  storage: StorageAdapter;
  transport: TransportAdapter;
  ownerDID: string;
  privateKey: Uint8Array;

  constructor(opts: MindspaceNodeOpts);

  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  isRunning(): boolean;
  getListenAddresses(): string[];
  async connectTo(addresses: string[]): Promise<void>;

  // Twin operations (delegate to kernel + sign + storage.dock)
  async createTwin(kind, schema, content): Promise<Twin>;
  async evolveTwin(twin, changes): Promise<Twin>;

  // Task management (delegate to createTwin + publish)
  async createTask(opts): Promise<Twin>;
  async getTasksForRole(role): Promise<Twin[]>;
  async getTaskByLogicalId(id): Promise<Twin | null>;
  async getLatestTwin(logicalId): Promise<Twin | null>;
  async transitionTask(logicalId, status, actor): Promise<Twin>;
  async approveTask(logicalId): Promise<Twin>;
  async dockWithValidation(newTwin, previousTwin): Promise<void>;

  // Runner management
  async addRunner(opts): Promise<Runner>;
  getRunners(): Runner[];
  async terminateRunner(id): Promise<void>;
}
```

### Wiring (what connects to what)

```
MindspaceNode
├── FileStorageAdapter(storeDir)     — from src/xp0/storage/
├── LibP2PTransport(listenPort, bootstrapPeers) — from src/xp0/transport/
├── kernel.create/sign/evolve        — from src/xp0/twin/
├── auth.generateKeyPair/deriveDID   — from src/xp0/auth/
├── WorkflowEngine(defaultRules)     — from src/xp0/workflow/
├── TransactionValidator             — from src/xp0/validation/
└── Runner[]                         — from src/xp0/runner/
    └── each Runner uses node.storage + node.transport (not its own)
```

### Key Design Points

1. **Runner uses node's transport** — Runner subscribes to task topics via `node.transport.subscribe()`. Runner does NOT have its own libp2p connection.

2. **createTwin = kernel.create + kernel.sign + storage.dock** — every twin created through MindspaceNode is signed by the owner and stored.

3. **createTask = createTwin(task schema) + transport.publish** — tasks are twins announced to the network.

4. **transitionTask = getLatest + evolve + validate + dock + publish** — state transitions go through the full validation chain.

5. **dockWithValidation = validate(new, prev) + storage.dock** — every dock runs the 6-step transaction validator.

### Tests Already Written

`src/xp0/test/e2e-integration.test.ts` defines T5.1–T5.x. The task is done when those tests pass.

### Dev Instructions

1. Create `src/xp0/node/mindspace-node.ts`
2. Wire: FileStorageAdapter, LibP2PTransport, kernel.*, auth.*
3. Implement createTwin/evolveTwin as kernel+sign+dock
4. Implement createTask as createTwin+publish
5. Implement addRunner using existing Runner class
6. Make T5.1 pass first (start/stop lifecycle)
7. Then T5.2 (runner connects through node)
8. Update `src/xp0/node/index.ts` barrel export
9. Git add, commit, push

### What NOT To Do

- Do NOT add new algorithms — this is wiring only
- Do NOT duplicate logic from existing modules
- Do NOT add HTTP API (that's a separate concern)
- Do NOT add CLI (runner-process has main.ts for that)
- Do NOT modify existing module interfaces

## Study / Act

(Populated after implementation)
