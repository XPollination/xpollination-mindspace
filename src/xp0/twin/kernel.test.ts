import { describe, it, expect } from 'vitest';
import { create, validate, sign, verify, evolve } from './kernel.js';
import type { Twin, UnsignedTwin, SignedTwin } from './types.js';

// Helper: generate Ed25519 keypair for tests
async function generateKeypair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  const ed = await import('@noble/ed25519');
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey };
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── AC1: create() produces a twin with valid CID (recomputable from content) ───

describe('create()', () => {
  it('creates an unsigned twin with a valid CID', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'Test' });
    expect(twin.cid).toBeDefined();
    expect(typeof twin.cid).toBe('string');
    expect(twin.cid.length).toBeGreaterThan(0);
  });

  it('sets default values: version=1, state=active, previousVersion=null', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'Test' });
    expect(twin.version).toBe(1);
    expect(twin.state).toBe('active');
    expect(twin.previousVersion).toBeNull();
  });

  it('returns an unsigned twin (signature=null)', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'Test' });
    expect(twin.signature).toBeNull();
  });

  it('CID is deterministic — same input produces same CID', async () => {
    const args = ['object', 'xp0/task', 'did:key:test-owner', { title: 'Test' }] as const;
    const twin1 = await create(...args);
    const twin2 = await create(...args);
    expect(twin1.cid).toBe(twin2.cid);
  });

  it('CID is recomputable — strip CID, recompute, matches', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'Test' });
    const { valid, errors } = await validate(twin);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('different content produces different CID', async () => {
    const twin1 = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'A' });
    const twin2 = await create('object', 'xp0/task', 'did:key:test-owner', { title: 'B' });
    expect(twin1.cid).not.toBe(twin2.cid);
  });

  it('sets kind, schema, owner from arguments', async () => {
    const twin = await create('relation', 'xp0/dep', 'did:key:owner1', {
      source: 'cid-a',
      target: 'cid-b',
      relationType: 'depends_on',
    });
    expect(twin.kind).toBe('relation');
    expect(twin.schema).toBe('xp0/dep');
    expect(twin.owner).toBe('did:key:owner1');
  });

  it('sets createdAt to an ISO 8601 timestamp', async () => {
    const before = new Date().toISOString();
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'T' });
    const after = new Date().toISOString();
    expect(twin.createdAt).toBeDefined();
    expect(twin.createdAt >= before).toBe(true);
    expect(twin.createdAt <= after).toBe(true);
  });

  it('sets tags to empty array by default', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'T' });
    expect(twin.tags).toEqual([]);
  });
});

// ─── AC5: All 4 kinds work: object, relation, schema, principal ───

describe('create() — all 4 kinds', () => {
  it('creates object kind twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Task' });
    expect(twin.kind).toBe('object');
    expect(twin.cid).toBeDefined();
  });

  it('creates relation kind twin', async () => {
    const twin = await create('relation', 'xp0/dep', 'did:key:owner', {
      source: 'cid-src',
      target: 'cid-tgt',
      relationType: 'depends_on',
    });
    expect(twin.kind).toBe('relation');
    expect(twin.cid).toBeDefined();
  });

  it('creates schema kind twin', async () => {
    const twin = await create('schema', 'xp0/schema', 'did:key:owner', {
      jsonSchema: { type: 'object', properties: { name: { type: 'string' } } },
      schemaId: 'xp0/task',
      version: '1.0.0',
    });
    expect(twin.kind).toBe('schema');
    expect(twin.cid).toBeDefined();
  });

  it('creates principal kind twin', async () => {
    const { publicKey } = await generateKeypair();
    const twin = await create('principal', 'xp0/principal', 'did:key:owner', {
      publicKey: hexEncode(publicKey),
      did: 'did:key:z6Mk...',
      displayName: 'Alice',
    });
    expect(twin.kind).toBe('principal');
    expect(twin.cid).toBeDefined();
  });
});

// ─── AC2: sign() produces Ed25519 signature verifiable with public key ───

describe('sign() and verify()', () => {
  it('sign() returns a signed twin with non-null signature', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const signed = await sign(twin, privateKey);
    expect(signed.signature).toBeDefined();
    expect(signed.signature).not.toBeNull();
    expect(typeof signed.signature).toBe('string');
    expect((signed.signature as string).length).toBeGreaterThan(0);
  });

  it('sign() does not mutate the original twin (immutability)', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const originalCid = twin.cid;
    const originalSig = twin.signature;
    await sign(twin, privateKey);
    expect(twin.cid).toBe(originalCid);
    expect(twin.signature).toBe(originalSig);
  });

  it('sign() preserves the CID (signing does not change content identity)', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const signed = await sign(twin, privateKey);
    expect(signed.cid).toBe(twin.cid);
  });

  it('verify() returns true for a correctly signed twin', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const signed = await sign(twin, privateKey);
    const isValid = await verify(signed);
    expect(isValid).toBe(true);
  });

  it('verify() returns false for an unsigned twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:test', { title: 'Test' });
    const isValid = await verify(twin);
    expect(isValid).toBe(false);
  });

  it('verify() returns false for a tampered twin (CID changed)', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const signed = await sign(twin, privateKey);
    const tampered = { ...signed, cid: 'bafyreifake000000000000000000000000000' };
    const isValid = await verify(tampered as SignedTwin);
    expect(isValid).toBe(false);
  });
});

// ─── AC3: evolve() links previousVersion correctly (Merkle-DAG chain) ───

describe('evolve()', () => {
  it('sets previousVersion to the original twin CID', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const evolved = await evolve(twin, { title: 'v2' });
    expect(evolved.previousVersion).toBe(twin.cid);
  });

  it('increments version by 1', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    expect(twin.version).toBe(1);
    const evolved = await evolve(twin, { title: 'v2' });
    expect(evolved.version).toBe(2);
  });

  it('produces a new CID (different from original)', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const evolved = await evolve(twin, { title: 'v2' });
    expect(evolved.cid).not.toBe(twin.cid);
  });

  it('merges content changes into existing content', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1', priority: 'high' });
    const evolved = await evolve(twin, { title: 'v2' });
    expect(evolved.content).toEqual({ title: 'v2', priority: 'high' });
  });

  it('does not mutate the original twin', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const originalCid = twin.cid;
    await evolve(twin, { title: 'v2' });
    expect(twin.cid).toBe(originalCid);
    expect(twin.version).toBe(1);
    expect(twin.previousVersion).toBeNull();
  });

  it('returns an unsigned twin (signature stripped on evolve)', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'v1' });
    const signed = await sign(twin, privateKey);
    const evolved = await evolve(signed, { title: 'v2' });
    expect(evolved.signature).toBeNull();
  });

  it('supports multi-step evolution (v1 → v2 → v3 chain)', async () => {
    const v1 = await create('object', 'xp0/task', 'did:key:owner', { title: 'v1' });
    const v2 = await evolve(v1, { title: 'v2' });
    const v3 = await evolve(v2, { title: 'v3' });
    expect(v1.previousVersion).toBeNull();
    expect(v2.previousVersion).toBe(v1.cid);
    expect(v3.previousVersion).toBe(v2.cid);
    expect(v3.version).toBe(3);
  });
});

// ─── AC4: validate() rejects unsigned twins, invalid CIDs, wrong kind-specific fields ───

describe('validate()', () => {
  it('valid twin passes validation', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    const { valid, errors } = await validate(twin);
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects twin with tampered CID', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Test' });
    const tampered = { ...twin, cid: 'bafyreifake000000000000000000000000000' };
    const { valid, errors } = await validate(tampered as Twin);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('cid'))).toBe(true);
  });

  it('rejects twin with tampered content (CID mismatch)', async () => {
    const twin = await create('object', 'xp0/task', 'did:key:owner', { title: 'Original' });
    const tampered = { ...twin, content: { title: 'Tampered' } };
    const { valid, errors } = await validate(tampered as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('cid'))).toBe(true);
  });

  it('rejects relation twin missing source', async () => {
    const twin = await create('relation', 'xp0/dep', 'did:key:owner', {
      source: 'cid-a',
      target: 'cid-b',
      relationType: 'depends_on',
    });
    const broken = { ...twin, content: { target: 'cid-b', relationType: 'depends_on' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('source'))).toBe(true);
  });

  it('rejects relation twin missing target', async () => {
    const twin = await create('relation', 'xp0/dep', 'did:key:owner', {
      source: 'cid-a',
      target: 'cid-b',
      relationType: 'depends_on',
    });
    const broken = { ...twin, content: { source: 'cid-a', relationType: 'depends_on' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('target'))).toBe(true);
  });

  it('rejects relation twin missing relationType', async () => {
    const twin = await create('relation', 'xp0/dep', 'did:key:owner', {
      source: 'cid-a',
      target: 'cid-b',
      relationType: 'depends_on',
    });
    const broken = { ...twin, content: { source: 'cid-a', target: 'cid-b' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('relationType') || e.toLowerCase().includes('relation'))).toBe(true);
  });

  it('rejects schema twin missing jsonSchema', async () => {
    const twin = await create('schema', 'xp0/schema', 'did:key:owner', {
      jsonSchema: { type: 'object' },
      schemaId: 'xp0/task',
      version: '1.0.0',
    });
    const broken = { ...twin, content: { schemaId: 'xp0/task', version: '1.0.0' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('schema') || e.toLowerCase().includes('jsonschema'))).toBe(true);
  });

  it('rejects schema twin missing schemaId', async () => {
    const twin = await create('schema', 'xp0/schema', 'did:key:owner', {
      jsonSchema: { type: 'object' },
      schemaId: 'xp0/task',
      version: '1.0.0',
    });
    const broken = { ...twin, content: { jsonSchema: { type: 'object' }, version: '1.0.0' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('schemaid') || e.toLowerCase().includes('schema'))).toBe(true);
  });

  it('rejects principal twin missing publicKey', async () => {
    const twin = await create('principal', 'xp0/principal', 'did:key:owner', {
      publicKey: 'abc123',
      did: 'did:key:z6Mk...',
      displayName: 'Alice',
    });
    const broken = { ...twin, content: { did: 'did:key:z6Mk...', displayName: 'Alice' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('publickey') || e.toLowerCase().includes('public'))).toBe(true);
  });

  it('rejects principal twin missing did', async () => {
    const twin = await create('principal', 'xp0/principal', 'did:key:owner', {
      publicKey: 'abc123',
      did: 'did:key:z6Mk...',
      displayName: 'Alice',
    });
    const broken = { ...twin, content: { publicKey: 'abc123', displayName: 'Alice' } };
    const { valid, errors } = await validate(broken as Twin);
    expect(valid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('did'))).toBe(true);
  });

  it('validates a correctly signed twin', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const owner = `did:key:z${hexEncode(publicKey)}`;
    const twin = await create('object', 'xp0/task', owner, { title: 'Test' });
    const signed = await sign(twin, privateKey);
    const { valid, errors } = await validate(signed);
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });
});
