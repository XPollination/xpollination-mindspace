import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Runner } from './runner.js';
import { ClaudeBridge } from './claude-bridge.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { create } from '../twin/kernel.js';

// Path to mock-claude (compiled)
const MOCK_CLAUDE = resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js');

let storeDir: string;
let storage: FileStorageAdapter;
let runner: Runner;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-runner-test-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  if (runner) await runner.stop().catch(() => {});
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC1: Runner creates valid runner-twin on startup ───

describe('runner startup', () => {
  it('creates a signed runner-twin with valid CID on start', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();
    const runnerTwin = runner.getRunnerTwin();

    expect(runnerTwin).toBeDefined();
    expect(runnerTwin.cid).toBeDefined();
    expect(runnerTwin.kind).toBe('object');
    expect(runnerTwin.schema).toBe('xp0/runner/v0.0.1');
    expect(runnerTwin.signature).not.toBeNull();
    expect((runnerTwin.content as any).name).toBe('test-runner');
    expect((runnerTwin.content as any).status).toBe('ready');
  });

  it('runner-twin is stored in storage adapter', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();
    const runnerTwin = runner.getRunnerTwin();
    const resolved = await storage.resolve(runnerTwin.cid);
    expect(resolved).not.toBeNull();
  });
});

// ─── AC3: Runner claims task via twin evolution ───

describe('task claiming', () => {
  it('claims a task by evolving task twin to active', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();

    // Create a ready task twin
    const taskTwin = await create('object', 'xp0/task', did, {
      title: 'Test task',
      status: 'ready',
      role: 'dev',
      logicalId: 'test-task-1',
    });
    await storage.dock(taskTwin);

    const claimed = await runner.claimTask(taskTwin);
    expect(claimed).not.toBeNull();
    expect((claimed!.content as any).status).toBe('active');
    expect(claimed!.previousVersion).toBe(taskTwin.cid);
  });
});

// ─── AC4: Claude --print called with DNA, stdout captured ───

describe('ClaudeBridge', () => {
  it('calls mock-claude and captures stdout', async () => {
    const bridge = new ClaudeBridge({ binary: MOCK_CLAUDE });
    const result = await bridge.execute('Test prompt content');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns deterministic output for same prompt', async () => {
    const bridge = new ClaudeBridge({ binary: MOCK_CLAUDE });
    const result1 = await bridge.execute('Deterministic test');
    const result2 = await bridge.execute('Deterministic test');
    expect(result1).toBe(result2);
  });

  it('handles failure exit code', async () => {
    const bridge = new ClaudeBridge({
      binary: MOCK_CLAUDE,
      env: { MOCK_CLAUDE_EXIT_CODE: '1' },
    });
    await expect(bridge.execute('Will fail')).rejects.toThrow();
  });
});

// ─── AC5: Result written to task DNA ───

describe('task execution', () => {
  it('executes task and writes result to twin content', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();

    const taskTwin = await create('object', 'xp0/task', did, {
      title: 'Execute this task',
      description: 'Task DNA content for DEV implementation',
      status: 'ready',
      role: 'dev',
      logicalId: 'exec-task-1',
    });
    await storage.dock(taskTwin);

    const result = await runner.executeTask(taskTwin);
    expect(result).toBeDefined();
    expect((result.content as any).result).toBeDefined();
    expect((result.content as any).result.length).toBeGreaterThan(0);
  });
});

// ─── AC6: Task transitioned to next state ───

describe('task completion', () => {
  it('completes task by evolving to review state', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();

    const taskTwin = await create('object', 'xp0/task', did, {
      title: 'Complete this',
      status: 'ready',
      role: 'dev',
      logicalId: 'complete-task-1',
    });
    await storage.dock(taskTwin);

    const completed = await runner.completeTask(taskTwin);
    expect(completed).toBeDefined();
    expect((completed.content as any).status).toBe('review');
  });
});

// ─── AC7: Heartbeat evolves runner twin every 30s ───

describe('heartbeat', () => {
  it('heartbeat evolves runner twin with timestamp', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
      heartbeatInterval: 100, // Fast for tests
    });

    await runner.start();
    const initialTwin = runner.getRunnerTwin();

    // Wait for at least one heartbeat
    await new Promise(resolve => setTimeout(resolve, 250));

    const updatedTwin = runner.getRunnerTwin();
    expect(updatedTwin.cid).not.toBe(initialTwin.cid);
    expect(updatedTwin.previousVersion).toBeDefined();
    expect((updatedTwin.content as any).lastHeartbeat).toBeDefined();
  }, 5000);
});

// ─── AC8: Shutdown ───

describe('shutdown', () => {
  it('evolves runner twin to stopped on shutdown', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();
    await runner.stop();

    const finalTwin = runner.getRunnerTwin();
    expect((finalTwin.content as any).status).toBe('stopped');
  });

  it('stop is idempotent', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    runner = new Runner({
      name: 'test-runner',
      roles: ['dev'],
      owner: did,
      privateKey,
      publicKey,
      storage,
      binary: MOCK_CLAUDE,
    });

    await runner.start();
    await runner.stop();
    await expect(runner.stop()).resolves.not.toThrow();
  });
});
