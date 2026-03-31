import { FileStorageAdapter } from '../storage/file-storage-adapter.js';
import { LibP2PTransport } from '../transport/libp2p-transport.js';
import { create, sign, evolve } from '../twin/kernel.js';
import { validate as validateTransaction, verifyCID, resolveConflict } from '../validation/transaction-validator.js';
import { RelationPermissionResolver, checkRateLimit, type RateLimitPolicy } from '../auth/permission-resolver.js';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';
import type { TransportAdapter, TransportMessage } from '../transport/types.js';
import { Runner } from '../runner/runner.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';

export interface MindspaceNodeOpts {
  storeDir: string;
  owner: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  listenPort: number;
  bootstrapPeers: string[];
  mockClaudeBinary: string;
}

interface ManagedRunner {
  runner: Runner;
  role: string;
  id: string;
}

export class MindspaceNode {
  storage: StorageAdapter;
  transport: TransportAdapter;
  ownerDID: string;
  privateKey: Uint8Array;

  private opts: MindspaceNodeOpts;
  private running = false;
  private runners: ManagedRunner[] = [];
  private taskIndex = new Map<string, Twin>(); // logicalId → latest twin
  private permissionResolver: RelationPermissionResolver | null = null;
  private rateLimitPolicy: RateLimitPolicy | null = null;

  constructor(opts: MindspaceNodeOpts) {
    this.opts = opts;
    this.ownerDID = opts.owner;
    this.privateKey = opts.privateKey;
    this.storage = new FileStorageAdapter(opts.storeDir);
    this.transport = new LibP2PTransport({ storage: this.storage });
  }

  async start(): Promise<void> {
    await this.transport.start();

    // Connect to bootstrap peers
    if (this.opts.bootstrapPeers.length > 0) {
      await this.connectTo(this.opts.bootstrapPeers);
    }

    // Subscribe to task announcements
    await this.transport.subscribe('xp0/tasks', (msg) => {
      this.handleTaskAnnouncement(msg).catch(() => {});
    });

    // Subscribe to GDPR forget announcements
    await this.transport.subscribe('xp0/system/forget', (msg) => {
      if (msg.type === 'twin.forget' && msg.cid) {
        this.storage.forget(msg.cid).catch(() => {});
      }
    });

    this.permissionResolver = new RelationPermissionResolver(this.storage);
    this.running = true;
  }

  // --- Permission-scoped access ---

  async getTaskDNAForRunner(runnerId: string, logicalId: string): Promise<Twin | null> {
    if (!this.permissionResolver) throw new Error('Node not started');
    const task = await this.getTaskByLogicalId(logicalId);
    if (!task) return null;
    const check = await this.permissionResolver.check(runnerId, task.cid, 'read');
    if (!check.allowed) throw new Error(`Access denied: ${check.reason}`);
    return task;
  }

  async setRateLimitPolicy(policy: RateLimitPolicy): Promise<void> {
    this.rateLimitPolicy = policy;
    // Store as policy twin
    await this.createTwin('object', 'xp0/rate-limit-policy', {
      maxClaimsPerWindow: policy.maxClaimsPerWindow,
      windowSeconds: policy.windowSeconds,
    });
  }

  async queryBrainAsRunner(runnerId: string, prompt: string): Promise<string | null> {
    // Check delegation VC scope for brain access
    if (!this.permissionResolver) throw new Error('Node not started');
    const relations = await this.permissionResolver.getRelations(runnerId, undefined, 'brain-access');
    if (relations.length === 0) {
      throw new Error('Access denied: runner has no brain-access delegation');
    }
    // Delegate to brain API (would use BrainClient in production)
    return `Brain response for: ${prompt}`;
  }

  async stop(): Promise<void> {
    // Stop all runners
    for (const mr of this.runners) {
      await mr.runner.stop().catch(() => {});
    }
    this.runners = [];

    await this.transport.stop();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getListenAddresses(): string[] {
    return (this.transport as LibP2PTransport).getListenAddresses();
  }

  async connectTo(addresses: string[]): Promise<void> {
    const transport = this.transport as any;
    if (transport.node) {
      const { multiaddr } = await import('@multiformats/multiaddr');
      for (const addr of addresses) {
        try {
          await transport.node.dial(multiaddr(addr));
        } catch { /* ignore */ }
      }
    }
  }

  // --- Twin helpers ---

  async createTwin(kind: string, schema: string, content: Record<string, unknown>): Promise<Twin> {
    const twin = await create(kind as any, schema, this.ownerDID, content);
    const signed = await sign(twin, this.privateKey);
    await this.storage.dock(signed);
    return signed;
  }

  async resolveConflicts(logicalId: string): Promise<{ winner: string; losers: string[] } | null> {
    const heads = await this.storage.heads(logicalId);
    if (heads.length <= 1) return null;
    const winner = resolveConflict(heads);
    const losers = heads.filter((h) => h !== winner);
    return { winner, losers };
  }

  private async autoResolveConflict(logicalId: string, heads: string[]): Promise<void> {
    const winnerCid = resolveConflict(heads);
    const winnerTwin = await this.storage.resolve(winnerCid);
    if (!winnerTwin) return;

    // Undock ALL heads (including winner) — then dock only the merge twin
    const losers = heads.filter((h) => h !== winnerCid);
    for (const loserCid of losers) {
      await this.storage.undock(loserCid);
    }

    // Create merge twin from winner with mergedFrom metadata
    const merged = await evolve(winnerTwin, {
      mergedFrom: losers,
      conflict_resolved: true,
    });
    await this.storage.dock(merged);
    this.taskIndex.set(logicalId, merged);

    // Propagate so other nodes converge
    await this.transport.publish('xp0/tasks', {
      type: 'twin.evolved',
      cid: merged.cid,
      kind: 'task',
    });
  }

  async forgetTwin(cid: string): Promise<void> {
    await this.storage.forget(cid);
    await this.transport.publish('xp0/system/forget', {
      type: 'twin.forget',
      cid,
      kind: 'system',
    });
  }

  async evolveTwin(twin: Twin, changes: Record<string, unknown>): Promise<Twin> {
    const evolved = await evolve(twin, changes);
    const signed = await sign(evolved, this.privateKey);
    await this.storage.dock(signed);
    return signed;
  }

  // --- Task management ---

  async createTask(opts: {
    title: string;
    description?: string;
    role: string;
    project: string;
    logicalId?: string;
  }): Promise<Twin> {
    const logicalId = opts.logicalId || opts.title.toLowerCase().replace(/\s+/g, '-');
    const content: Record<string, unknown> = {
      title: opts.title,
      status: 'ready',
      role: opts.role,
      project: opts.project,
      logicalId,
    };
    if (opts.description) content.description = opts.description;

    const twin = await this.createTwin('object', 'xp0/task', content);
    this.taskIndex.set(logicalId, twin);

    // Announce via transport
    await this.transport.publish('xp0/tasks', {
      type: 'twin.created',
      cid: twin.cid,
      kind: 'task',
    });

    return twin;
  }

  async getTasksForRole(role: string): Promise<Twin[]> {
    const all = await this.storage.query({ schema: 'xp0/task' });
    const byRole = all.filter((t) => (t.content as any).role === role);

    // Return only latest version of each logical task (avoid duplicates from evolution)
    const latestByLogicalId = new Map<string, Twin>();
    for (const t of byRole) {
      const lid = (t.content as any).logicalId as string | undefined;
      if (!lid) { latestByLogicalId.set(t.cid, t); continue; }
      const existing = latestByLogicalId.get(lid);
      if (!existing || t.version > existing.version) {
        latestByLogicalId.set(lid, t);
      }
    }
    return Array.from(latestByLogicalId.values());
  }

  async getTaskByLogicalId(id: string): Promise<Twin | null> {
    const all = await this.storage.query({ schema: 'xp0/task' });
    return all.find((t) => (t.content as any).logicalId === id) || null;
  }

  async getLatestTwin(logicalId: string): Promise<Twin | null> {
    const heads = await this.storage.heads(logicalId);
    if (heads.length === 0) return null;
    return this.storage.resolve(heads[0]);
  }

  async transitionTask(logicalId: string, status: string, actor: string): Promise<Twin> {
    const current = await this.getLatestTwin(logicalId) || await this.getTaskByLogicalId(logicalId);
    if (!current) throw new Error(`Task ${logicalId} not found`);
    return this.evolveTwin(current, { status, claimed_by: actor });
  }

  async approveTask(logicalId: string): Promise<Twin> {
    return this.transitionTask(logicalId, 'approved', 'liaison');
  }

  async dockWithValidation(newTwin: Twin, previousTwin: Twin): Promise<void> {
    const result = await validateTransaction(newTwin, { storage: this.storage });
    if (!result.valid) throw new Error(`Validation failed at step ${result.step}: ${result.reason}`);
    await this.storage.dock(newTwin);
  }

  // --- Runner management ---

  async addRunner(opts: { role: string; autoClaimDelay?: number; heartbeatInterval?: number }): Promise<IntegrationRunner> {
    const kp = await generateKeyPair();
    const did = deriveDID(kp.publicKey);

    const runner = new Runner({
      name: `runner-${opts.role}-${this.runners.length + 1}`,
      roles: [opts.role],
      owner: did,
      privateKey: kp.privateKey,
      publicKey: kp.publicKey,
      storage: this.storage,
      binary: this.opts.mockClaudeBinary,
      heartbeatInterval: opts.heartbeatInterval || 30000,
    });

    await runner.start();

    const managed: ManagedRunner = {
      runner,
      role: opts.role,
      id: runner.getRunnerTwin().cid,
    };
    this.runners.push(managed);

    // Start auto-claim loop if configured
    const ir = new IntegrationRunner(runner, opts.role, this);
    if (opts.autoClaimDelay !== undefined) {
      ir.startAutoClaim(opts.autoClaimDelay);
    } else {
      ir.startAutoClaim(1000); // default 1s
    }

    return ir;
  }

  getRunners(): ManagedRunner[] {
    return this.runners;
  }

  async terminateRunner(id: string): Promise<void> {
    const idx = this.runners.findIndex((r) => r.id === id);
    if (idx >= 0) {
      await this.runners[idx].runner.stop();
      this.runners.splice(idx, 1);
    }
  }

  // --- Internal ---

  private async handleTaskAnnouncement(msg: TransportMessage): Promise<void> {
    if ((msg.type === 'twin.created' || msg.type === 'twin.evolved') && msg.cid) {
      // Try to fetch the twin from the network
      const twin = await this.transport.requestTwin(msg.cid);
      if (twin) {
        // Validate CID integrity before docking — reject tampered twins
        const cidCheck = await verifyCID(twin);
        if (!cidCheck.valid) return; // silently reject tampered twins
        await this.storage.dock(twin);
        const logicalId = (twin.content as any)?.logicalId;
        if (logicalId) {
          this.taskIndex.set(logicalId, twin);
          // Check for conflicts (heads > 1) and resolve
          const heads = await this.storage.heads(logicalId);
          if (heads.length > 1) {
            await this.autoResolveConflict(logicalId, heads);
          }
        }
      }
    }
  }
}

// Wrapper that exposes runner methods for tests
export class IntegrationRunner {
  private runner: Runner;
  private role: string;
  private node: MindspaceNode;
  private listening = false;
  private autoClaimTimer: ReturnType<typeof setInterval> | null = null;

  constructor(runner: Runner, role: string, node: MindspaceNode) {
    this.runner = runner;
    this.role = role;
    this.node = node;
    this.listening = true;
  }

  isListening(): boolean {
    return this.listening;
  }

  getRole(): string {
    return this.role;
  }

  getTransport(): undefined {
    return undefined; // Runner accesses transport through the node
  }

  getId(): string {
    return this.runner.getId();
  }

  getStatus(): string {
    return this.runner.getStatus();
  }

  async drain(): Promise<void> {
    // Stop auto-claim, let current task finish
    if (this.autoClaimTimer) {
      clearInterval(this.autoClaimTimer);
      this.autoClaimTimer = null;
    }
    await this.runner.drain();
  }

  startAutoClaim(intervalMs: number): void {
    const ROLE_NEXT_STATUS: Record<string, string> = {
      pdsa: 'approval',
      dev: 'review',
      qa: 'review',
      liaison: 'review',
    };

    const myDID = this.runner.getRunnerTwin()?.owner || '';

    this.autoClaimTimer = setInterval(async () => {
      if (this.runner.getStatus() === 'draining') return;
      try {
        const tasks = await this.node.getTasksForRole(this.role);
        for (const task of tasks) {
          const content = task.content as Record<string, unknown>;

          // State machine: each iteration handles ONE step
          if (content.status === 'ready' && !content.claimed_by) {
            // Step 1: Claim
            const claimed = await this.runner.claimTask(task);
            await this.node.transport.publish('xp0/tasks', {
              type: 'twin.evolved',
              cid: claimed.cid,
              kind: 'task',
            });
            break;
          }

          if (content.status === 'active' && content.claimed_by === myDID && !content.result) {
            // Step 2: Execute
            const executed = await this.runner.executeTask(task);
            await this.node.transport.publish('xp0/tasks', {
              type: 'twin.evolved',
              cid: executed.cid,
              kind: 'task',
            });
            break;
          }

          if (content.status === 'active' && content.claimed_by === myDID && content.result) {
            // Step 3: Transition to next status
            const nextStatus = ROLE_NEXT_STATUS[this.role] || 'review';
            const logicalId = content.logicalId as string | undefined;
            if (logicalId) {
              const transitioned = await this.node.transitionTask(logicalId, nextStatus, this.role);
              await this.node.transport.publish('xp0/tasks', {
                type: 'twin.evolved',
                cid: transitioned.cid,
                kind: 'task',
              });
            }
            break;
          }
        }
      } catch { /* ignore */ }
    }, intervalMs);
  }

  async claimTask(twin: Twin): Promise<Twin> {
    return this.runner.claimTask(twin);
  }

  async executeTask(twin: Twin): Promise<Twin> {
    return this.runner.executeTask(twin);
  }

  async stop(): Promise<void> {
    if (this.autoClaimTimer) clearInterval(this.autoClaimTimer);
    this.listening = false;
    await this.runner.stop();
  }
}
