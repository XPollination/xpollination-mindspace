import { create, sign, evolve } from '../twin/kernel.js';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';
import { ClaudeBridge } from './claude-bridge.js';

interface RunnerOpts {
  name: string;
  roles: string[];
  owner: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  storage: StorageAdapter;
  binary: string;
  heartbeatInterval?: number;
}

export class Runner {
  private opts: RunnerOpts;
  private bridge: ClaudeBridge;
  private runnerTwin: Twin | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(opts: RunnerOpts) {
    this.opts = opts;
    this.bridge = new ClaudeBridge({ binary: opts.binary });
  }

  async start(): Promise<void> {
    this.stopped = false;

    // Create and sign runner twin
    const twin = await create('object', 'xp0/runner/v0.0.1', this.opts.owner, {
      name: this.opts.name,
      principal: this.opts.owner,
      owner: this.opts.owner,
      roles: this.opts.roles,
      workload: {
        type: 'claude-code',
        binary: this.opts.binary,
        mode: 'print',
      },
      hardware: {
        location: 'local',
        network: 'localhost',
        resources: {},
      },
      status: 'ready',
      maxConcurrent: 1,
      heartbeatInterval: this.opts.heartbeatInterval || 30000,
    });

    this.runnerTwin = await sign(twin, this.opts.privateKey);
    await this.opts.storage.dock(this.runnerTwin);

    // Start heartbeat
    const interval = this.opts.heartbeatInterval || 30000;
    this.heartbeatTimer = setInterval(() => this.heartbeat().catch(() => {}), interval);
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.runnerTwin && !this.stopped) {
      this.stopped = true;
      const evolved = await evolve(this.runnerTwin, { status: 'stopped' });
      this.runnerTwin = await sign(evolved, this.opts.privateKey);
      await this.opts.storage.dock(this.runnerTwin);
    }
  }

  getRunnerTwin(): Twin {
    if (!this.runnerTwin) throw new Error('Runner not started');
    return this.runnerTwin;
  }

  getId(): string {
    return this.runnerTwin?.cid || '';
  }

  getStatus(): string {
    if (!this.runnerTwin) return 'stopped';
    return (this.runnerTwin.content as Record<string, unknown>).status as string || 'unknown';
  }

  async drain(): Promise<void> {
    // Stop accepting new tasks, finish current
    if (this.runnerTwin && !this.stopped) {
      const evolved = await evolve(this.runnerTwin, { status: 'draining' });
      this.runnerTwin = await sign(evolved, this.opts.privateKey);
      await this.opts.storage.dock(this.runnerTwin);
    }
  }

  async claimTask(taskTwin: Twin): Promise<Twin> {
    const claimed = await evolve(taskTwin, { status: 'active', claimed_by: this.opts.owner });
    await this.opts.storage.dock(claimed);
    return claimed;
  }

  async executeTask(taskTwin: Twin): Promise<Twin> {
    const content = taskTwin.content as Record<string, unknown>;
    const prompt = [content.title, content.description].filter(Boolean).join('\n\n');
    const result = await this.bridge.execute(prompt);
    const withResult = await evolve(taskTwin, { result });
    await this.opts.storage.dock(withResult);
    return withResult;
  }

  async completeTask(taskTwin: Twin): Promise<Twin> {
    const completed = await evolve(taskTwin, { status: 'review' });
    await this.opts.storage.dock(completed);
    return completed;
  }

  private async heartbeat(): Promise<void> {
    if (!this.runnerTwin || this.stopped) return;
    const evolved = await evolve(this.runnerTwin, {
      lastHeartbeat: new Date().toISOString(),
    });
    this.runnerTwin = await sign(evolved, this.opts.privateKey);
    await this.opts.storage.dock(this.runnerTwin);
  }
}
