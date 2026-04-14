import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validate,
  verifyCID,
  verifySignature,
  verifyDelegation,
  verifyChain,
  verifyWorkflow,
  resolveConflict,
} from './transaction-validator.js';
import { create, sign, evolve } from '../twin/kernel.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { createDelegationVC } from '../auth/delegation.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';

let storeDir: string;
let storage: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-tx-test-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// Helper: create a fully valid signed twin with delegation
async function createValidSignedTwin() {
  const owner = await generateKeyPair();
  const ownerDID = deriveDID(owner.publicKey);
  const twin = await create('object', 'xp0/task', ownerDID, { title: 'Valid task' });
  const signed = await sign(twin, owner.privateKey);
  return { signed, owner, ownerDID };
}

// ─── Step 1: CID Integrity ───

describe('verifyCID()', () => {
  it('returns valid=true for untampered twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    const result = await verifyCID(twin);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for tampered CID', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    const tampered = { ...twin, cid: 'bafyreifake000000000000000' };
    const result = await verifyCID(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns valid=false for tampered content', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Original' });
    const tampered = { ...twin, content: { title: 'Tampered' } };
    const result = await verifyCID(tampered);
    expect(result.valid).toBe(false);
  });
});

// ─── Step 2: Signature verification ───

describe('verifySignature()', () => {
  it('returns valid=true for correctly signed twin', async () => {
    const { signed } = await createValidSignedTwin();
    const result = await verifySignature(signed);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for unsigned twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    const result = await verifySignature(twin);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsigned|signature/i);
  });

  it('returns valid=false for forged signature', async () => {
    const { signed } = await createValidSignedTwin();
    const forged = { ...signed, signature: 'a'.repeat(128) };
    const result = await verifySignature(forged);
    expect(result.valid).toBe(false);
  });
});

// ─── Step 3: Delegation verification ───

describe('verifyDelegation()', () => {
  it('returns valid=true when runner has valid delegation', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['evolve-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const twin = await create('object', 'xp0/task', runnerDID, { title: 'Task' });
    const signed = await sign(twin, runner.privateKey);

    const result = await verifyDelegation(signed, {
      requiredOperation: 'evolve-tasks',
      vcCid: vc.cid,
      storage,
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid=false when delegation is expired', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['evolve-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date(Date.now() - 86400000 * 2).toISOString(),
      validUntil: new Date(Date.now() - 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const twin = await create('object', 'xp0/task', runnerDID, { title: 'Task' });
    const signed = await sign(twin, runner.privateKey);

    const result = await verifyDelegation(signed, {
      requiredOperation: 'evolve-tasks',
      vcCid: vc.cid,
      storage,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expir/i);
  });
});

// ─── Step 4: Merkle-DAG chain verification ───

describe('verifyChain()', () => {
  it('returns valid=true for genesis twin (no previousVersion)', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    await storage.dock(twin);
    const result = await verifyChain(twin, storage);
    expect(result.valid).toBe(true);
  });

  it('returns valid=true for valid chain (v1→v2)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const v2 = await evolve(v1, { title: 'v2' });
    await storage.dock(v1);
    await storage.dock(v2);
    const result = await verifyChain(v2, storage);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for broken chain (previousVersion missing from storage)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const v2 = await evolve(v1, { title: 'v2' });
    // Only dock v2, not v1 — chain is broken
    await storage.dock(v2);
    const result = await verifyChain(v2, storage);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/chain|previous/i);
  });
});

// ─── Step 5: Workflow transition verification ───

describe('verifyWorkflow()', () => {
  it('returns valid=true for valid transition (ready→active)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', {
      title: 'Task',
      status: 'ready',
      role: 'dev',
    });
    const v2 = await evolve(v1, { status: 'active' });
    const result = verifyWorkflow(v1, v2);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for invalid transition (ready→complete)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', {
      title: 'Task',
      status: 'ready',
      role: 'dev',
    });
    const v2 = await evolve(v1, { status: 'complete' });
    const result = verifyWorkflow(v1, v2);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/transition|workflow/i);
  });
});

// ─── Step 6: Conflict resolution ───

describe('resolveConflict()', () => {
  it('returns single winner from multiple heads', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1', logicalId: 'task-1' });
    const v2a = await evolve(v1, { title: 'v2a' });
    const v2b = await evolve(v1, { title: 'v2b' });
    await storage.dock(v1);
    await storage.dock(v2a);
    await storage.dock(v2b);

    const winner = resolveConflict([v2a.cid, v2b.cid]);
    expect(winner).toBeDefined();
    expect([v2a.cid, v2b.cid]).toContain(winner);
  });

  it('deterministic — lowest CID always wins', () => {
    const cids = ['bafyreiz9999', 'bafyreia0001', 'bafyreic5555'];
    const winner1 = resolveConflict(cids);
    const winner2 = resolveConflict([...cids].reverse());
    expect(winner1).toBe(winner2);
    // Lowest alphabetically
    const sorted = [...cids].sort();
    expect(winner1).toBe(sorted[0]);
  });

  it('all peers arrive at same winner (property test)', () => {
    const cids = ['bafyreiAABB', 'bafyreiAACC', 'bafyreiAADD'];
    // Simulate 3 different peers seeing CIDs in different order
    const peer1 = resolveConflict([cids[0], cids[1], cids[2]]);
    const peer2 = resolveConflict([cids[2], cids[0], cids[1]]);
    const peer3 = resolveConflict([cids[1], cids[2], cids[0]]);
    expect(peer1).toBe(peer2);
    expect(peer2).toBe(peer3);
  });

  it('returns the only CID when there is no conflict', () => {
    const winner = resolveConflict(['bafyreiSingle']);
    expect(winner).toBe('bafyreiSingle');
  });
});

// ─── Full validate() — runs all 6 steps ───

describe('validate() — full pipeline', () => {
  it('passes for a fully valid signed twin', async () => {
    const { signed } = await createValidSignedTwin();
    await storage.dock(signed);
    const result = await validate(signed, { storage });
    expect(result.valid).toBe(true);
    expect(result.step).toBeUndefined();
  });

  it('fails at step 1 for tampered CID', async () => {
    const { signed } = await createValidSignedTwin();
    const tampered = { ...signed, cid: 'bafyreifake' };
    const result = await validate(tampered, { storage });
    expect(result.valid).toBe(false);
    expect(result.step).toBe(1);
  });

  it('fails at step 2 for forged signature', async () => {
    const { signed } = await createValidSignedTwin();
    const forged = { ...signed, signature: 'a'.repeat(128) };
    const result = await validate(forged, { storage });
    expect(result.valid).toBe(false);
    expect(result.step).toBe(2);
  });
});

// ─── Security tests ───

describe('security: T-SEC-1 — rogue runner (no delegation)', () => {
  it('rejects twin from runner without valid delegation', async () => {
    const rogue = await generateKeyPair();
    const rogueDID = deriveDID(rogue.publicKey);
    const twin = await create('object', 'xp0/task', rogueDID, { title: 'Rogue task' });
    const signed = await sign(twin, rogue.privateKey);

    const result = await verifyDelegation(signed, {
      requiredOperation: 'evolve-tasks',
      vcCid: 'bafyrei-nonexistent',
      storage,
    });
    expect(result.valid).toBe(false);
  });
});

describe('security: T-SEC-2 — impersonation', () => {
  it('rejects twin signed by wrong key claiming another DID', async () => {
    const legitimate = await generateKeyPair();
    const impersonator = await generateKeyPair();
    const legitimateDID = deriveDID(legitimate.publicKey);

    // Impersonator creates twin claiming to be legitimate owner
    const twin = await create('object', 'xp0/task', legitimateDID, { title: 'Impersonated' });
    const signed = await sign(twin, impersonator.privateKey);

    const result = await verifySignature(signed);
    expect(result.valid).toBe(false);
  });
});
