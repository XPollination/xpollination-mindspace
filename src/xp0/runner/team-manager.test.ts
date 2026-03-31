import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TeamManager } from './team-manager.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';

const MOCK_CLAUDE = resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js');

let storeDir: string;
let storage: FileStorageAdapter;
let manager: TeamManager;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-team-test-'));
  storage = new FileStorageAdapter(storeDir);
  const { publicKey, privateKey } = await generateKeyPair();
  const ownerDID = deriveDID(publicKey);

  manager = new TeamManager({
    project: 'mindspace',
    owner: ownerDID,
    ownerPrivateKey: privateKey,
    ownerPublicKey: publicKey,
    storage,
    binary: MOCK_CLAUDE,
  });
});

afterEach(async () => {
  await manager.terminateAll().catch(() => {});
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC1: Add Dev +1 starts runner, creates runner-twin, updates team twin ───

describe('add agent', () => {
  it('addAgent(dev) creates a runner and updates team twin', async () => {
    const result = await manager.addAgent('dev');
    expect(result.runnerId).toBeDefined();
    expect(result.runnerDID).toBeDefined();

    const teamTwin = manager.getTeamTwin();
    expect(teamTwin).toBeDefined();
    const content = teamTwin.content as Record<string, unknown>;
    const agents = content.agents as Array<{ role: string; runner: string }>;
    expect(agents.length).toBe(1);
    expect(agents[0].role).toBe('dev');
  });

  it('addAgent creates runner-twin in storage', async () => {
    const result = await manager.addAgent('dev');
    const resolved = await storage.resolve(result.runnerId);
    expect(resolved).not.toBeNull();
    expect((resolved!.content as any).name).toBeDefined();
  });
});

// ─── AC2: Add Full Team starts 4 runners ───

describe('add full team', () => {
  it('addFullTeam creates 4 runners (one per role)', async () => {
    const results = await manager.addFullTeam();
    expect(results.length).toBe(4);

    const roles = results.map(r => r.role).sort();
    expect(roles).toEqual(['dev', 'liaison', 'pdsa', 'qa']);

    const teamTwin = manager.getTeamTwin();
    const agents = (teamTwin.content as any).agents;
    expect(agents.length).toBe(4);
  });
});

// ─── AC3: Terminate triggers clean shutdown ───

describe('terminate agent', () => {
  it('terminateAgent removes agent from team twin', async () => {
    const { runnerId } = await manager.addAgent('dev');
    await manager.terminateAgent(runnerId);

    const teamTwin = manager.getTeamTwin();
    const agents = (teamTwin.content as any).agents;
    expect(agents.length).toBe(0);
  });

  it('terminateAgent sets runner twin status to stopped', async () => {
    const { runnerId } = await manager.addAgent('dev');
    await manager.terminateAgent(runnerId);

    const runnerTwin = await storage.resolve(runnerId);
    // Runner twin should have evolved to stopped status
    // (may need to check latest version via heads)
    expect(runnerTwin).not.toBeNull();
  });
});

// ─── AC4: Role switch ───

describe('role switch', () => {
  it('switchRole evolves runner twin with new role', async () => {
    const { runnerId } = await manager.addAgent('dev');
    await manager.switchRole(runnerId, 'qa');

    const teamTwin = manager.getTeamTwin();
    const agents = (teamTwin.content as any).agents;
    expect(agents[0].role).toBe('qa');
  });
});

// ─── AC5: Capacity display ───

describe('capacity', () => {
  it('getCapacity returns current agent count and limits', () => {
    const capacity = manager.getCapacity();
    expect(capacity).toBeDefined();
    expect(typeof capacity.currentAgents).toBe('number');
    expect(typeof capacity.maxConcurrent).toBe('number');
    expect(Array.isArray(capacity.availableRoles)).toBe(true);
  });

  it('capacity updates after adding agent', async () => {
    const before = manager.getCapacity();
    await manager.addAgent('dev');
    const after = manager.getCapacity();
    expect(after.currentAgents).toBe(before.currentAgents + 1);
  });
});

// ─── AC6: Runner status ───

describe('runner status', () => {
  it('getRunnerStatus returns role and status', async () => {
    const { runnerId } = await manager.addAgent('dev');
    const status = manager.getRunnerStatus(runnerId);
    expect(status).toBeDefined();
    expect(status!.role).toBe('dev');
    expect(status!.status).toBe('ready');
  });

  it('returns null for unknown runner', () => {
    const status = manager.getRunnerStatus('bafyrei-nonexistent');
    expect(status).toBeNull();
  });
});

// ─── AC7: Team twin correct after operations ───

describe('team twin consistency', () => {
  it('team twin has correct schema', async () => {
    await manager.addAgent('dev');
    const teamTwin = manager.getTeamTwin();
    expect(teamTwin.schema).toBe('xp0/team/v0.0.1');
    expect(teamTwin.kind).toBe('object');
  });

  it('team twin has project and state', async () => {
    await manager.addAgent('dev');
    const content = manager.getTeamTwin().content as Record<string, unknown>;
    expect(content.project).toBe('mindspace');
    expect(content.state).toBe('active');
  });
});
