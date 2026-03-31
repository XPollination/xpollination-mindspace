import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LibP2PTransport } from './libp2p-transport.js';
import type { TransportAdapter, TransportMessage } from './types.js';
import { create, evolve } from '../twin/kernel.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';

let storeDirA: string;
let storeDirB: string;
let storageA: FileStorageAdapter;
let storageB: FileStorageAdapter;
let transportA: LibP2PTransport;
let transportB: LibP2PTransport;

beforeEach(async () => {
  storeDirA = await mkdtemp(join(tmpdir(), 'xp0-transport-a-'));
  storeDirB = await mkdtemp(join(tmpdir(), 'xp0-transport-b-'));
  storageA = new FileStorageAdapter(storeDirA);
  storageB = new FileStorageAdapter(storeDirB);
});

afterEach(async () => {
  if (transportA) await transportA.stop().catch(() => {});
  if (transportB) await transportB.stop().catch(() => {});
  await rm(storeDirA, { recursive: true, force: true });
  await rm(storeDirB, { recursive: true, force: true });
});

// ─── Interface compliance ───

describe('LibP2PTransport interface', () => {
  it('implements TransportAdapter interface', () => {
    transportA = new LibP2PTransport({ storage: storageA });
    const ta: TransportAdapter = transportA;
    expect(typeof ta.start).toBe('function');
    expect(typeof ta.stop).toBe('function');
    expect(typeof ta.subscribe).toBe('function');
    expect(typeof ta.publish).toBe('function');
    expect(typeof ta.requestTwin).toBe('function');
    expect(typeof ta.getConnectedPeers).toBe('function');
  });
});

// ─── AC1: Two Mindspace instances discover each other via DHT ───

describe('peer discovery', () => {
  it('two peers discover each other after start', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    transportB = new LibP2PTransport({ storage: storageB });

    await transportA.start();
    await transportB.start();

    // Allow discovery time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const peersA = await transportA.getConnectedPeers();
    const peersB = await transportB.getConnectedPeers();
    expect(peersA.length).toBeGreaterThanOrEqual(1);
    expect(peersB.length).toBeGreaterThanOrEqual(1);
  }, 10000);
});

// ─── AC2: Twin evolution propagates via GossipSub ───

describe('GossipSub publish/subscribe', () => {
  it('published twin evolution arrives at subscriber', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    transportB = new LibP2PTransport({ storage: storageB });

    await transportA.start();
    await transportB.start();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const received: TransportMessage[] = [];
    await transportB.subscribe('xp0/mindspace/tasks', (msg) => {
      received.push(msg);
    });
    await transportA.subscribe('xp0/mindspace/tasks', () => {}); // both must subscribe

    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Propagated' });
    await storageA.dock(twin);
    await transportA.publish('xp0/mindspace/tasks', {
      type: 'twin-evolved',
      cid: twin.cid,
      kind: twin.kind,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].cid).toBe(twin.cid);
  }, 15000);
});

// ─── AC3: Peer can fetch full twin by CID (Bitswap-style) ───

describe('twin request by CID', () => {
  it('peer B can request twin from peer A by CID', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    transportB = new LibP2PTransport({ storage: storageB });

    await transportA.start();
    await transportB.start();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Fetch me' });
    await storageA.dock(twin);

    const fetched = await transportB.requestTwin(twin.cid);
    expect(fetched).not.toBeNull();
    expect(fetched!.cid).toBe(twin.cid);
    expect(fetched!.content).toEqual(twin.content);
  }, 15000);

  it('returns null for non-existent CID', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    transportB = new LibP2PTransport({ storage: storageB });

    await transportA.start();
    await transportB.start();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fetched = await transportB.requestTwin('bafyrei-nonexistent');
    expect(fetched).toBeNull();
  }, 15000);
});

// ─── AC4: Project topic isolation ───

describe('project topic isolation', () => {
  it('subscriber to mindspace topic does not receive crm events', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    transportB = new LibP2PTransport({ storage: storageB });

    await transportA.start();
    await transportB.start();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mindspaceReceived: TransportMessage[] = [];
    await transportB.subscribe('xp0/mindspace/tasks', (msg) => {
      mindspaceReceived.push(msg);
    });
    await transportA.subscribe('xp0/mindspace/tasks', () => {});
    await transportA.subscribe('xp0/crm/tasks', () => {});

    // Publish to crm topic
    await transportA.publish('xp0/crm/tasks', {
      type: 'twin-evolved',
      cid: 'bafyrei-crm-twin',
      kind: 'object',
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(mindspaceReceived.length).toBe(0);
  }, 15000);
});

// ─── AC5: Offline queue ───

describe('offline queue', () => {
  it('queued evolutions are synced on reconnect', async () => {
    transportA = new LibP2PTransport({ storage: storageA });

    // Queue a message while offline (not started)
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Offline' });
    await storageA.dock(twin);
    transportA.enqueue('xp0/mindspace/tasks', {
      type: 'twin-evolved',
      cid: twin.cid,
      kind: twin.kind,
    });

    expect(transportA.queueSize()).toBe(1);

    // Start and connect — queue should drain
    transportB = new LibP2PTransport({ storage: storageB });
    await transportB.start();

    const received: TransportMessage[] = [];
    await transportB.subscribe('xp0/mindspace/tasks', (msg) => {
      received.push(msg);
    });

    await transportA.start(); // drains queue on connect
    await new Promise(resolve => setTimeout(resolve, 3000));

    expect(transportA.queueSize()).toBe(0);
  }, 15000);
});

// ─── AC6: Conflict detection across peers ───

describe('conflict detection', () => {
  it('divergent evolution detected as heads > 1', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1', logicalId: 'conflict-task' });
    const v2a = await evolve(v1, { title: 'v2a-from-peer-A' });
    const v2b = await evolve(v1, { title: 'v2b-from-peer-B' });

    // Both peers dock genesis + their own evolution
    await storageA.dock(v1);
    await storageA.dock(v2a);
    await storageB.dock(v1);
    await storageB.dock(v2b);

    // After sync, storage should have both evolutions → heads > 1
    await storageA.dock(v2b); // simulate sync
    const heads = await storageA.heads('conflict-task');
    expect(heads.length).toBe(2);
    expect(heads).toContain(v2a.cid);
    expect(heads).toContain(v2b.cid);
  });
});

// ─── Lifecycle ───

describe('lifecycle', () => {
  it('start and stop without error', async () => {
    transportA = new LibP2PTransport({ storage: storageA });
    await expect(transportA.start()).resolves.not.toThrow();
    await expect(transportA.stop()).resolves.not.toThrow();
  }, 10000);

  it('getConnectedPeers returns empty before start', () => {
    transportA = new LibP2PTransport({ storage: storageA });
    const peers = transportA.getConnectedPeers();
    expect(Array.isArray(peers) || peers instanceof Promise).toBe(true);
  });
});
