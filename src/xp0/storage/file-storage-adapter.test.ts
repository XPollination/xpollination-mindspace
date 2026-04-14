import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorageAdapter } from './file-storage-adapter.js';
import type { StorageAdapter, QueryFilter } from './types.js';
import { create, evolve } from '../twin/kernel.js';

let storeDir: string;
let adapter: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-test-'));
  adapter = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC7: Adapter satisfies StorageAdapter interface ───

describe('FileStorageAdapter interface compliance', () => {
  it('implements StorageAdapter interface', () => {
    const sa: StorageAdapter = adapter;
    expect(typeof sa.dock).toBe('function');
    expect(typeof sa.resolve).toBe('function');
    expect(typeof sa.query).toBe('function');
    expect(typeof sa.heads).toBe('function');
    expect(typeof sa.history).toBe('function');
    expect(typeof sa.undock).toBe('function');
    expect(typeof sa.forget).toBe('function');
  });
});

// ─── AC1: dock() creates valid JSON file, CID recomputable from file content ───

describe('dock()', () => {
  it('creates a JSON file on disk', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    // File should exist at {storeDir}/{cid[0:4]}/{cid}.json
    const prefix = twin.cid.substring(0, 4);
    const filePath = join(storeDir, prefix, `${twin.cid}.json`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.cid).toBe(twin.cid);
  });

  it('stored file content matches the docked twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    const resolved = await adapter.resolve(twin.cid);
    expect(resolved).not.toBeNull();
    expect(resolved!.cid).toBe(twin.cid);
    expect(resolved!.kind).toBe(twin.kind);
    expect(resolved!.content).toEqual(twin.content);
  });

  it('creates prefix directories automatically', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    const prefix = twin.cid.substring(0, 4);
    const dirs = await readdir(storeDir);
    expect(dirs).toContain(prefix);
  });

  it('docking the same twin twice does not throw', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    await expect(adapter.dock(twin)).resolves.not.toThrow();
  });
});

// ─── AC2: resolve() reads file, verifies CID matches ───

describe('resolve()', () => {
  it('returns the twin for a valid CID', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    const resolved = await adapter.resolve(twin.cid);
    expect(resolved).not.toBeNull();
    expect(resolved!.cid).toBe(twin.cid);
  });

  it('returns null for a non-existent CID', async () => {
    const resolved = await adapter.resolve('bafyrei-nonexistent');
    expect(resolved).toBeNull();
  });

  it('preserves all twin fields through dock/resolve roundtrip', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', {
      title: 'Test',
      priority: 'high',
    });
    await adapter.dock(twin);
    const resolved = await adapter.resolve(twin.cid);
    expect(resolved!.kind).toBe(twin.kind);
    expect(resolved!.schema).toBe(twin.schema);
    expect(resolved!.owner).toBe(twin.owner);
    expect(resolved!.version).toBe(twin.version);
    expect(resolved!.state).toBe(twin.state);
    expect(resolved!.tags).toEqual(twin.tags);
    expect(resolved!.previousVersion).toBe(twin.previousVersion);
  });
});

// ─── AC3: query() returns correct subset (test with 10+ twins) ───

describe('query()', () => {
  it('returns all twins when no filter is applied', async () => {
    const twins = await Promise.all([
      create('object', 'xp0/task', 'did:key:a', { title: 'Task 1' }),
      create('object', 'xp0/task', 'did:key:b', { title: 'Task 2' }),
      create('relation', 'xp0/dep', 'did:key:a', { source: 'c1', target: 'c2', relationType: 'dep' }),
    ]);
    for (const t of twins) await adapter.dock(t);
    const results = await adapter.query({});
    expect(results.length).toBe(3);
  });

  it('filters by kind', async () => {
    const t1 = await create('object', 'xp0/task', 'did:key:a', { title: 'Task' });
    const t2 = await create('relation', 'xp0/dep', 'did:key:a', { source: 'c1', target: 'c2', relationType: 'dep' });
    const t3 = await create('object', 'xp0/note', 'did:key:a', { text: 'Note' });
    for (const t of [t1, t2, t3]) await adapter.dock(t);
    const results = await adapter.query({ kind: 'object' });
    expect(results.length).toBe(2);
    expect(results.every(r => r.kind === 'object')).toBe(true);
  });

  it('filters by schema', async () => {
    const t1 = await create('object', 'xp0/task', 'did:key:a', { title: 'Task' });
    const t2 = await create('object', 'xp0/note', 'did:key:a', { text: 'Note' });
    for (const t of [t1, t2]) await adapter.dock(t);
    const results = await adapter.query({ schema: 'xp0/task' });
    expect(results.length).toBe(1);
    expect(results[0].schema).toBe('xp0/task');
  });

  it('filters by owner', async () => {
    const t1 = await create('object', 'xp0/task', 'did:key:alice', { title: 'A' });
    const t2 = await create('object', 'xp0/task', 'did:key:bob', { title: 'B' });
    for (const t of [t1, t2]) await adapter.dock(t);
    const results = await adapter.query({ owner: 'did:key:alice' });
    expect(results.length).toBe(1);
    expect(results[0].owner).toBe('did:key:alice');
  });

  it('filters by tags (any match)', async () => {
    const t1 = await create('object', 'xp0/task', 'did:key:a', { title: 'A' });
    const t2 = await create('object', 'xp0/task', 'did:key:a', { title: 'B' });
    // Need to dock twins with tags — evolve/create with tag support
    // Since create() sets tags=[], we manually set them for test
    const tagged1 = { ...t1, tags: ['urgent', 'bug'] };
    const tagged2 = { ...t2, tags: ['feature'] };
    await adapter.dock(tagged1);
    await adapter.dock(tagged2);
    const results = await adapter.query({ tags: ['urgent'] });
    expect(results.length).toBe(1);
    expect(results[0].tags).toContain('urgent');
  });

  it('filters by state', async () => {
    const t1 = await create('object', 'xp0/task', 'did:key:a', { title: 'A' });
    const t2 = { ...(await create('object', 'xp0/task', 'did:key:a', { title: 'B' })), state: 'archived' };
    await adapter.dock(t1);
    await adapter.dock(t2);
    const results = await adapter.query({ state: 'active' });
    expect(results.length).toBe(1);
    expect(results[0].state).toBe('active');
  });

  it('respects limit', async () => {
    const twins = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        create('object', 'xp0/task', 'did:key:a', { title: `Task ${i}` })
      )
    );
    for (const t of twins) await adapter.dock(t);
    const results = await adapter.query({ limit: 2 });
    expect(results.length).toBe(2);
  });

  it('handles query with 10+ twins of different kinds', async () => {
    const twins = await Promise.all([
      create('object', 'xp0/task', 'did:key:a', { title: 'T1' }),
      create('object', 'xp0/task', 'did:key:a', { title: 'T2' }),
      create('object', 'xp0/task', 'did:key:b', { title: 'T3' }),
      create('object', 'xp0/note', 'did:key:a', { text: 'N1' }),
      create('object', 'xp0/note', 'did:key:a', { text: 'N2' }),
      create('relation', 'xp0/dep', 'did:key:a', { source: 'c1', target: 'c2', relationType: 'dep' }),
      create('relation', 'xp0/dep', 'did:key:a', { source: 'c3', target: 'c4', relationType: 'owns' }),
      create('schema', 'xp0/schema', 'did:key:a', { jsonSchema: { type: 'object' }, schemaId: 's1', version: '1' }),
      create('principal', 'xp0/principal', 'did:key:a', { publicKey: 'pk1', did: 'did:key:a', displayName: 'A' }),
      create('principal', 'xp0/principal', 'did:key:b', { publicKey: 'pk2', did: 'did:key:b', displayName: 'B' }),
      create('object', 'xp0/task', 'did:key:c', { title: 'T4' }),
    ]);
    for (const t of twins) await adapter.dock(t);

    // Query all
    const all = await adapter.query({});
    expect(all.length).toBe(11);

    // Query by kind
    const relations = await adapter.query({ kind: 'relation' });
    expect(relations.length).toBe(2);

    // Query by schema
    const tasks = await adapter.query({ schema: 'xp0/task' });
    expect(tasks.length).toBe(4);
  });
});

// ─── AC4: heads() returns 1 CID for normal chain, 2+ CIDs for conflict ───

describe('heads()', () => {
  it('returns 1 head for a single twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const withLogicalId = { ...twin, content: { ...twin.content, logicalId: 'task-1' } };
    await adapter.dock(withLogicalId);
    const h = await adapter.heads('task-1');
    expect(h.length).toBe(1);
    expect(h[0]).toBe(withLogicalId.cid);
  });

  it('returns 1 head for a linear chain (v1 → v2 → v3)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1', logicalId: 'task-1' });
    const v2 = await evolve(v1, { title: 'v2' });
    const v3 = await evolve(v2, { title: 'v3' });
    await adapter.dock(v1);
    await adapter.dock(v2);
    await adapter.dock(v3);
    const h = await adapter.heads('task-1');
    expect(h.length).toBe(1);
    expect(h[0]).toBe(v3.cid);
  });

  it('returns 2+ heads for a conflict (divergent evolution)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1', logicalId: 'task-conflict' });
    // Two different evolutions from v1
    const v2a = await evolve(v1, { title: 'v2a' });
    const v2b = await evolve(v1, { title: 'v2b' });
    await adapter.dock(v1);
    await adapter.dock(v2a);
    await adapter.dock(v2b);
    const h = await adapter.heads('task-conflict');
    expect(h.length).toBe(2);
    expect(h).toContain(v2a.cid);
    expect(h).toContain(v2b.cid);
  });

  it('returns empty array for unknown logicalId', async () => {
    const h = await adapter.heads('nonexistent');
    expect(h).toEqual([]);
  });
});

// ─── AC5: history() walks full chain from latest to genesis ───

describe('history()', () => {
  it('returns single-element array for genesis twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    await adapter.dock(twin);
    const hist = await adapter.history(twin.cid);
    expect(hist.length).toBe(1);
    expect(hist[0].cid).toBe(twin.cid);
  });

  it('walks full chain from latest to genesis (3 versions)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const v2 = await evolve(v1, { title: 'v2' });
    const v3 = await evolve(v2, { title: 'v3' });
    await adapter.dock(v1);
    await adapter.dock(v2);
    await adapter.dock(v3);
    const hist = await adapter.history(v3.cid);
    expect(hist.length).toBe(3);
    expect(hist[0].cid).toBe(v3.cid);
    expect(hist[1].cid).toBe(v2.cid);
    expect(hist[2].cid).toBe(v1.cid);
  });

  it('returns empty array for non-existent CID', async () => {
    const hist = await adapter.history('bafyrei-nonexistent');
    expect(hist).toEqual([]);
  });
});

// ─── AC6: forget() purges content but CID marker remains, chain doesn't break ───

describe('forget()', () => {
  it('purges content but file still exists', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Sensitive' });
    await adapter.dock(twin);
    await adapter.forget(twin.cid);
    // File should still exist
    const prefix = twin.cid.substring(0, 4);
    const filePath = join(storeDir, prefix, `${twin.cid}.json`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.state).toBe('forgotten');
    // Original content should be purged
    expect(parsed.content?.title).toBeUndefined();
  });

  it('forgotten twin is still resolvable', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Sensitive' });
    await adapter.dock(twin);
    await adapter.forget(twin.cid);
    const resolved = await adapter.resolve(twin.cid);
    expect(resolved).not.toBeNull();
    expect(resolved!.state).toBe('forgotten');
  });

  it('history chain survives forget of middle twin', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const v2 = await evolve(v1, { title: 'v2-sensitive' });
    const v3 = await evolve(v2, { title: 'v3' });
    await adapter.dock(v1);
    await adapter.dock(v2);
    await adapter.dock(v3);
    // Forget the middle twin
    await adapter.forget(v2.cid);
    // History should still walk (v3 → v2-forgotten → v1)
    const hist = await adapter.history(v3.cid);
    expect(hist.length).toBe(3);
    expect(hist[0].cid).toBe(v3.cid);
    expect(hist[1].cid).toBe(v2.cid);
    expect(hist[1].state).toBe('forgotten');
    expect(hist[2].cid).toBe(v1.cid);
  });
});

// ─── undock() ───

describe('undock()', () => {
  it('removes the twin file', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    await adapter.dock(twin);
    await adapter.undock(twin.cid);
    const resolved = await adapter.resolve(twin.cid);
    expect(resolved).toBeNull();
  });

  it('does not throw when undocking a non-existent CID', async () => {
    await expect(adapter.undock('bafyrei-nonexistent')).resolves.not.toThrow();
  });
});
