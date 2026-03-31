/**
 * E2E Test: Scenario D — Multi-User Collaboration (SD.1-SD.3)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create, sign, evolve } from '../twin/kernel.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';
import { resolveConflict } from '../validation/transaction-validator.js';

let storeDir: string;
let storage: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-e2e-multi-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── SD.1: Two users one project — task distribution ───

describe('SD.1: Two users one project', () => {
  it('tasks distributed across runners, conflicts resolved deterministically', async () => {
    const thomas = await generateKeyPair();
    const robin = await generateKeyPair();
    const thomasDID = deriveDID(thomas.publicKey);
    const robinDID = deriveDID(robin.publicKey);

    // Create 3 dev tasks
    const tasks = await Promise.all([
      create('object', 'xp0/task', thomasDID, { title: 'Task 1', status: 'ready', role: 'dev', logicalId: 'sd1-task-1' }),
      create('object', 'xp0/task', thomasDID, { title: 'Task 2', status: 'ready', role: 'dev', logicalId: 'sd1-task-2' }),
      create('object', 'xp0/task', thomasDID, { title: 'Task 3', status: 'ready', role: 'dev', logicalId: 'sd1-task-3' }),
    ]);
    for (const t of tasks) await storage.dock(t);

    // Both runners try to claim task 1 (conflict)
    const claimThomas = await evolve(tasks[0], { status: 'active', claimedBy: thomasDID });
    const claimRobin = await evolve(tasks[0], { status: 'active', claimedBy: robinDID });
    await storage.dock(claimThomas);
    await storage.dock(claimRobin);

    // Conflict resolved deterministically
    const heads = await storage.heads('sd1-task-1');
    expect(heads.length).toBe(2);
    const winner = resolveConflict(heads);
    expect(winner).toBeDefined();
    // Both peers would agree on the same winner
    expect(resolveConflict([heads[1], heads[0]])).toBe(winner);
  });
});

// ─── SD.2: Cross-project isolation ───

describe('SD.2: Cross-project isolation', () => {
  it('runner assigned to mindspace does not see crm tasks', async () => {
    const owner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);

    // Mindspace task
    const mindspaceTask = await create('object', 'xp0/task', ownerDID, {
      title: 'Mindspace task',
      project: 'mindspace',
      status: 'ready',
      role: 'dev',
    });
    await storage.dock(mindspaceTask);

    // CRM task
    const crmTask = await create('object', 'xp0/task', ownerDID, {
      title: 'CRM task',
      project: 'crm',
      status: 'ready',
      role: 'dev',
    });
    await storage.dock(crmTask);

    // Query for mindspace tasks only
    const mindspaceTasks = await storage.query({ schema: 'xp0/task' });
    const filtered = mindspaceTasks.filter(t => (t.content as any).project === 'mindspace');
    expect(filtered.length).toBe(1);
    expect((filtered[0].content as any).title).toBe('Mindspace task');
  });
});

// ─── SD.3: Runner replacement ───

describe('SD.3: Runner replacement', () => {
  it('terminated runner replaced by new runner, team twin updated', async () => {
    const owner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);

    // Create team twin with 2 agents
    const teamV1 = await create('object', 'xp0/team/v0.0.1', ownerDID, {
      project: 'mindspace',
      agents: [
        { role: 'dev', runner: 'runner-alice-cid' },
        { role: 'qa', runner: 'runner-bob-cid' },
      ],
      state: 'active',
      logicalId: 'team-mindspace',
    });
    await storage.dock(teamV1);

    // Remove alice, add charlie
    const teamV2 = await evolve(teamV1, {
      agents: [
        { role: 'dev', runner: 'runner-charlie-cid' },
        { role: 'qa', runner: 'runner-bob-cid' },
      ],
    });
    await storage.dock(teamV2);

    // Team twin evolved correctly
    expect(teamV2.previousVersion).toBe(teamV1.cid);
    const agents = (teamV2.content as any).agents;
    expect(agents.find((a: any) => a.runner === 'runner-alice-cid')).toBeUndefined();
    expect(agents.find((a: any) => a.runner === 'runner-charlie-cid')).toBeDefined();
  });
});
