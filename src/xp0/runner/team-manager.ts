import { create, sign, evolve } from '../twin/kernel.js';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';
import { Runner } from './runner.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';

interface TeamManagerOpts {
  project: string;
  owner: string;
  ownerPrivateKey: Uint8Array;
  ownerPublicKey: Uint8Array;
  storage: StorageAdapter;
  binary: string;
}

interface AgentEntry {
  role: string;
  runner: string; // CID of runner-twin
  runnerId: string;
}

interface AddAgentResult {
  runnerId: string;
  runnerDID: string;
  role: string;
}

interface RunnerStatus {
  role: string;
  status: string;
}

export class TeamManager {
  private opts: TeamManagerOpts;
  private teamTwin: Twin | null = null;
  private runners = new Map<string, { runner: Runner; role: string; did: string }>();

  constructor(opts: TeamManagerOpts) {
    this.opts = opts;
  }

  async addAgent(role: string): Promise<AddAgentResult> {
    const kp = await generateKeyPair();
    const did = deriveDID(kp.publicKey);

    const runner = new Runner({
      name: `${this.opts.project}-${role}-${this.runners.size + 1}`,
      roles: [role],
      owner: did,
      privateKey: kp.privateKey,
      publicKey: kp.publicKey,
      storage: this.opts.storage,
      binary: this.opts.binary,
    });

    await runner.start();
    const runnerTwin = runner.getRunnerTwin();
    const runnerId = runnerTwin.cid;

    this.runners.set(runnerId, { runner, role, did });
    await this.updateTeamTwin();

    return { runnerId, runnerDID: did, role };
  }

  async addFullTeam(): Promise<AddAgentResult[]> {
    const roles = ['liaison', 'pdsa', 'qa', 'dev'];
    const results: AddAgentResult[] = [];
    for (const role of roles) {
      results.push(await this.addAgent(role));
    }
    return results;
  }

  async terminateAgent(runnerId: string): Promise<void> {
    const entry = this.runners.get(runnerId);
    if (entry) {
      await entry.runner.stop();
      this.runners.delete(runnerId);
      await this.updateTeamTwin();
    }
  }

  async terminateAll(): Promise<void> {
    for (const [id] of this.runners) {
      const entry = this.runners.get(id);
      if (entry) await entry.runner.stop().catch(() => {});
    }
    this.runners.clear();
  }

  async switchRole(runnerId: string, newRole: string): Promise<void> {
    const entry = this.runners.get(runnerId);
    if (!entry) return;
    entry.role = newRole;
    await this.updateTeamTwin();
  }

  getTeamTwin(): Twin {
    if (!this.teamTwin) throw new Error('No team twin — add an agent first');
    return this.teamTwin;
  }

  getCapacity(): { currentAgents: number; maxConcurrent: number; availableRoles: string[] } {
    return {
      currentAgents: this.runners.size,
      maxConcurrent: 4,
      availableRoles: ['liaison', 'pdsa', 'qa', 'dev'],
    };
  }

  getRunnerStatus(runnerId: string): RunnerStatus | null {
    const entry = this.runners.get(runnerId);
    if (!entry) return null;
    const twin = entry.runner.getRunnerTwin();
    return {
      role: entry.role,
      status: (twin.content as Record<string, unknown>).status as string,
    };
  }

  private async updateTeamTwin(): Promise<void> {
    const agents: AgentEntry[] = [];
    for (const [cid, entry] of this.runners) {
      agents.push({ role: entry.role, runner: cid, runnerId: cid });
    }

    const content = {
      project: this.opts.project,
      owner: this.opts.owner,
      agents: agents.map((a) => ({ role: a.role, runner: a.runner })),
      capacity: {
        max_concurrent_agents: 4,
        available_roles: ['liaison', 'pdsa', 'qa', 'dev'],
      },
      workflow: 'pdsa-standard',
      state: 'active',
    };

    if (this.teamTwin) {
      const evolved = await evolve(this.teamTwin, content);
      this.teamTwin = await sign(evolved, this.opts.ownerPrivateKey);
    } else {
      const twin = await create('object', 'xp0/team/v0.0.1', this.opts.owner, content);
      this.teamTwin = await sign(twin, this.opts.ownerPrivateKey);
    }

    await this.opts.storage.dock(this.teamTwin);
  }
}
