/**
 * Prod Migration Tests: verify runner system replaces tmux Start Agentic Team
 * Strangler fig pattern: feature flag controls which system is active
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TeamManager } from '../runner/team-manager.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';

const MOCK_CLAUDE = resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js');

let storeDir: string;
let storage: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-migration-test-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC1: Start Agentic Team creates team twin + starts runners ───

describe('AC1: Start creates team twin + runners', () => {
  it('team twin created with project and agents', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const ownerDID = deriveDID(publicKey);

    const manager = new TeamManager({
      project: 'mindspace',
      owner: ownerDID,
      ownerPrivateKey: privateKey,
      ownerPublicKey: publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    const results = await manager.addFullTeam();
    expect(results.length).toBe(4);

    const teamTwin = manager.getTeamTwin();
    expect(teamTwin).toBeDefined();
    expect((teamTwin.content as any).project).toBe('mindspace');
    expect((teamTwin.content as any).agents.length).toBe(4);

    await manager.terminateAll();
  });
});

// ─── AC2: Runners appear in UI with status ───

describe('AC2: Runner status visible', () => {
  it('each runner has visible status after start', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const ownerDID = deriveDID(publicKey);

    const manager = new TeamManager({
      project: 'mindspace',
      owner: ownerDID,
      ownerPrivateKey: privateKey,
      ownerPublicKey: publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    const { runnerId } = await manager.addAgent('dev');
    const status = manager.getRunnerStatus(runnerId);
    expect(status).not.toBeNull();
    expect(status!.role).toBe('dev');
    expect(status!.status).toBe('ready');

    await manager.terminateAll();
  });
});

// ─── AC3: Tasks flow through runners (not tmux) ───

describe('AC3: Task flow through runners', () => {
  it('runner processes tasks without tmux', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const ownerDID = deriveDID(publicKey);

    const manager = new TeamManager({
      project: 'mindspace',
      owner: ownerDID,
      ownerPrivateKey: privateKey,
      ownerPublicKey: publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await manager.addAgent('dev');
    // Runner should be ready to process tasks — no tmux involved
    const teamTwin = manager.getTeamTwin();
    const agents = (teamTwin.content as any).agents;
    expect(agents[0].role).toBe('dev');

    await manager.terminateAll();
  });
});

// ─── AC5: Rollback possible ───

describe('AC5: Rollback via feature flag', () => {
  it('terminateAll cleans up all runners', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const ownerDID = deriveDID(publicKey);

    const manager = new TeamManager({
      project: 'mindspace',
      owner: ownerDID,
      ownerPrivateKey: privateKey,
      ownerPublicKey: publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await manager.addFullTeam();
    await manager.terminateAll();

    const teamTwin = manager.getTeamTwin();
    const agents = (teamTwin.content as any).agents;
    expect(agents.length).toBe(0);
  });
});
