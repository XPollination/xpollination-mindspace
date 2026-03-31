import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateKeyPair,
  deriveDID,
} from './identity.js';
import {
  createDelegationVC,
  verifyDelegation,
  revokeDelegation,
  isDelegationRevoked,
} from './delegation.js';
import {
  createChallenge,
  signChallenge,
  verifyChallenge,
} from './challenge.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';

let storeDir: string;
let storage: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-auth-test-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── AC1: generateKeyPair() produces valid Ed25519 pair ───

describe('generateKeyPair()', () => {
  it('returns publicKey and privateKey as Uint8Array', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(privateKey).toBeInstanceOf(Uint8Array);
  });

  it('publicKey is 32 bytes (Ed25519)', async () => {
    const { publicKey } = await generateKeyPair();
    expect(publicKey.length).toBe(32);
  });

  it('privateKey is 32 bytes (Ed25519 seed)', async () => {
    const { privateKey } = await generateKeyPair();
    expect(privateKey.length).toBe(32);
  });

  it('generates different keys each time', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    expect(Buffer.from(kp1.publicKey).toString('hex')).not.toBe(
      Buffer.from(kp2.publicKey).toString('hex')
    );
  });
});

// ─── AC2: deriveDID() produces valid did:key URI ───

describe('deriveDID()', () => {
  it('returns a string starting with did:key:z', async () => {
    const { publicKey } = await generateKeyPair();
    const did = deriveDID(publicKey);
    expect(did).toMatch(/^did:key:z/);
  });

  it('produces deterministic DID for same key', async () => {
    const { publicKey } = await generateKeyPair();
    const did1 = deriveDID(publicKey);
    const did2 = deriveDID(publicKey);
    expect(did1).toBe(did2);
  });

  it('produces different DID for different key', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const did1 = deriveDID(kp1.publicKey);
    const did2 = deriveDID(kp2.publicKey);
    expect(did1).not.toBe(did2);
  });

  it('DID contains z6Mk prefix (Ed25519 multicodec)', async () => {
    const { publicKey } = await generateKeyPair();
    const did = deriveDID(publicKey);
    // did:key Ed25519 keys start with z6Mk (0xed01 + base58btc)
    expect(did).toMatch(/^did:key:z6Mk/);
  });
});

// ─── AC3: createDelegationVC() produces a signed twin with correct scope ───

describe('createDelegationVC()', () => {
  it('creates a signed delegation VC twin', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks', 'evolve-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    expect(vc.signature).not.toBeNull();
    expect(vc.kind).toBe('object');
    expect(vc.schema).toBe('xp0/delegation-vc/v0.0.1');
  });

  it('VC content contains issuer, subject, and scope', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const content = vc.content as Record<string, unknown>;
    expect(content.issuer).toBe(ownerDID);
    expect(content.subject).toBe(runnerDID);
    expect(content.scope).toBeDefined();
    const scope = content.scope as Record<string, unknown>;
    expect(scope.operations).toContain('claim-tasks');
    expect(scope.roles).toContain('dev');
  });

  it('VC is stored in the storage adapter', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const resolved = await storage.resolve(vc.cid);
    expect(resolved).not.toBeNull();
  });
});

// ─── AC4: verifyDelegation() — valid/expired/wrong-scope/tombstoned ───

describe('verifyDelegation()', () => {
  it('returns valid=true for correct, non-expired VC', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const result = await verifyDelegation({
      vcCid: vc.cid,
      requiredOperation: 'claim-tasks',
      storage,
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid=false for expired VC', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date(Date.now() - 86400000 * 2).toISOString(),
      validUntil: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const result = await verifyDelegation({
      vcCid: vc.cid,
      requiredOperation: 'claim-tasks',
      storage,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expir/i);
  });

  it('returns valid=false for wrong operation scope', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['read-task-dna'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const result = await verifyDelegation({
      vcCid: vc.cid,
      requiredOperation: 'evolve-tasks', // not in scope
      storage,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/scope|operation/i);
  });

  it('returns valid=false for tombstoned (revoked) VC', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    await revokeDelegation(vc.cid, owner.privateKey, storage);

    const result = await verifyDelegation({
      vcCid: vc.cid,
      requiredOperation: 'claim-tasks',
      storage,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/revok|tombstone/i);
  });
});

// ─── AC5: Challenge-response create→sign→verify roundtrip ───

describe('challenge-response', () => {
  it('createChallenge() returns a non-empty string', () => {
    const challenge = createChallenge();
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('createChallenge() produces unique challenges', () => {
    const c1 = createChallenge();
    const c2 = createChallenge();
    expect(c1).not.toBe(c2);
  });

  it('signChallenge() returns a hex string signature', async () => {
    const { privateKey } = await generateKeyPair();
    const challenge = createChallenge();
    const signature = await signChallenge(challenge, privateKey);
    expect(typeof signature).toBe('string');
    expect(signature).toMatch(/^[0-9a-f]+$/i);
  });

  it('verifyChallenge() returns true for valid signature', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);
    const challenge = createChallenge();
    const signature = await signChallenge(challenge, privateKey);
    const result = await verifyChallenge(challenge, signature, did);
    expect(result).toBe(true);
  });

  it('verifyChallenge() returns false for wrong key', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const challenge = createChallenge();
    const signature = await signChallenge(challenge, kp1.privateKey);
    const wrongDID = deriveDID(kp2.publicKey);
    const result = await verifyChallenge(challenge, signature, wrongDID);
    expect(result).toBe(false);
  });

  it('verifyChallenge() returns false for tampered challenge', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);
    const challenge = createChallenge();
    const signature = await signChallenge(challenge, privateKey);
    const result = await verifyChallenge('tampered-challenge', signature, did);
    expect(result).toBe(false);
  });
});

// ─── AC6: Revocation — tombstoned VC ───

describe('revocation', () => {
  it('revokeDelegation() tombstones the VC', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    await revokeDelegation(vc.cid, owner.privateKey, storage);
    const revoked = await isDelegationRevoked(vc.cid, storage);
    expect(revoked).toBe(true);
  });

  it('isDelegationRevoked() returns false for non-revoked VC', async () => {
    const owner = await generateKeyPair();
    const runner = await generateKeyPair();
    const ownerDID = deriveDID(owner.publicKey);
    const runnerDID = deriveDID(runner.publicKey);

    const vc = await createDelegationVC({
      issuer: ownerDID,
      subject: runnerDID,
      scope: {
        operations: ['claim-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      issuerPrivateKey: owner.privateKey,
      storage,
    });

    const revoked = await isDelegationRevoked(vc.cid, storage);
    expect(revoked).toBe(false);
  });
});

// ─── AC7: Security tests ───

describe('security: T-SEC-1 — rogue runner rejected', () => {
  it('runner with no delegation VC is rejected', async () => {
    const result = await verifyDelegation({
      vcCid: 'bafyrei-nonexistent-vc',
      requiredOperation: 'claim-tasks',
      storage,
    });
    expect(result.valid).toBe(false);
  });
});

describe('security: T-SEC-2 — impersonation rejected', () => {
  it('challenge signed by wrong key is rejected', async () => {
    const legitimate = await generateKeyPair();
    const impersonator = await generateKeyPair();
    const legitimateDID = deriveDID(legitimate.publicKey);
    const challenge = createChallenge();
    // Impersonator signs with their key, claims legitimate DID
    const signature = await signChallenge(challenge, impersonator.privateKey);
    const result = await verifyChallenge(challenge, signature, legitimateDID);
    expect(result).toBe(false);
  });
});
