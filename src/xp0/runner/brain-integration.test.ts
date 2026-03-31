import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { BrainClient } from './brain-integration.js';

let storeDir: string;
let pendingFile: string;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-brain-test-'));
  pendingFile = join(storeDir, 'pending-contributions.json');
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC1: Runner queries brain on startup ───

describe('brain query on startup', () => {
  it('queryRecovery returns response from brain API', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:3200',
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    // This tests against the real brain API (integration test)
    // If brain is down, the fallback path is tested separately
    const result = await client.queryRecovery('Recovery context for dev agent');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

// ─── AC2: Runner contributes summary on shutdown ───

describe('brain contribution on shutdown', () => {
  it('contribute sends content to brain API', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:3200',
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    const result = await client.contribute('Test contribution from brain integration tests — session summary for testing purposes');
    expect(result.success).toBe(true);
  });
});

// ─── AC3: Brain unavailable — local fallback, no crash ───

describe('brain unavailable fallback', () => {
  it('saves contribution to local file when brain is unreachable', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:99999', // Unreachable
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    // Should not throw
    const result = await client.contribute('Contribution during brain outage — testing local fallback');
    expect(result.success).toBe(false);
    expect(result.savedLocally).toBe(true);

    // Verify local file was created
    expect(existsSync(pendingFile)).toBe(true);
    const content = JSON.parse(await readFile(pendingFile, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBe(1);
    expect(content[0].prompt).toContain('Contribution during brain outage');
  });

  it('query returns null when brain is unreachable (no crash)', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:99999', // Unreachable
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    const result = await client.queryRecovery('Test query');
    expect(result).toBeNull();
  });
});

// ─── AC4: Next session syncs pending contributions ───

describe('pending contribution sync', () => {
  it('syncs pending contributions when brain becomes available', async () => {
    // Write a pending contribution file
    const pending = [
      {
        prompt: 'Pending contribution from previous session — testing sync behavior',
        agent_id: 'agent-dev',
        agent_name: 'DEV',
        session_id: 'old-session',
        timestamp: new Date().toISOString(),
      },
    ];
    await writeFile(pendingFile, JSON.stringify(pending));

    const client = new BrainClient({
      apiUrl: 'http://localhost:3200',
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'new-session',
      pendingFile,
    });

    const synced = await client.syncPending();
    expect(synced).toBe(true);

    // Pending file should be empty or removed after sync
    if (existsSync(pendingFile)) {
      const remaining = JSON.parse(await readFile(pendingFile, 'utf-8'));
      expect(remaining.length).toBe(0);
    }
  });

  it('returns true when no pending contributions exist', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:3200',
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    const synced = await client.syncPending();
    expect(synced).toBe(true);
  });

  it('accumulates multiple pending contributions', async () => {
    const client = new BrainClient({
      apiUrl: 'http://localhost:99999', // Unreachable
      apiKey: 'test-key',
      agentId: 'agent-dev',
      agentName: 'DEV',
      sessionId: 'test-session',
      pendingFile,
    });

    await client.contribute('First pending contribution from brain integration tests — accumulation test 1');
    await client.contribute('Second pending contribution from brain integration tests — accumulation test 2');

    const content = JSON.parse(await readFile(pendingFile, 'utf-8'));
    expect(content.length).toBe(2);
  });
});
