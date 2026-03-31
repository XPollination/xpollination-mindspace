import { create, sign } from '../twin/kernel.js';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';

interface DelegationScope {
  operations: string[];
  roles: string[];
  projects: string[];
}

interface CreateDelegationParams {
  issuer: string;
  subject: string;
  scope: DelegationScope;
  validFrom: string;
  validUntil: string;
  issuerPrivateKey: Uint8Array;
  storage: StorageAdapter;
}

interface VerifyDelegationParams {
  vcCid: string;
  requiredOperation: string;
  storage: StorageAdapter;
}

export async function createDelegationVC(params: CreateDelegationParams): Promise<Twin> {
  const twin = await create('object', 'xp0/delegation-vc/v0.0.1', params.issuer, {
    issuer: params.issuer,
    subject: params.subject,
    scope: params.scope,
    validFrom: params.validFrom,
    validUntil: params.validUntil,
  });

  const signed = await sign(twin, params.issuerPrivateKey);
  await params.storage.dock(signed);
  return signed;
}

export async function verifyDelegation(
  params: VerifyDelegationParams,
): Promise<{ valid: boolean; reason?: string }> {
  const vc = await params.storage.resolve(params.vcCid);
  if (!vc) return { valid: false, reason: 'Delegation VC not found' };

  // Check revocation
  if (await isDelegationRevoked(params.vcCid, params.storage)) {
    return { valid: false, reason: 'Delegation revoked (tombstoned)' };
  }

  const content = vc.content as Record<string, unknown>;

  // Check expiry
  const validUntil = content.validUntil as string;
  if (validUntil && new Date(validUntil) < new Date()) {
    return { valid: false, reason: 'Delegation expired' };
  }

  // Check scope
  const scope = content.scope as DelegationScope | undefined;
  if (!scope || !scope.operations.includes(params.requiredOperation)) {
    return { valid: false, reason: `Operation '${params.requiredOperation}' not in scope` };
  }

  return { valid: true };
}

export async function revokeDelegation(
  vcCid: string,
  ownerPrivateKey: Uint8Array,
  storage: StorageAdapter,
): Promise<Twin> {
  const ed = await import('@noble/ed25519');
  const { deriveDID } = await import('./identity.js');
  const publicKey = await ed.getPublicKeyAsync(ownerPrivateKey);
  const ownerDID = deriveDID(publicKey);

  const revocation = await create('object', 'xp0/revocation', ownerDID, {
    revokedCid: vcCid,
    revokedAt: new Date().toISOString(),
  });

  const signed = await sign(revocation, ownerPrivateKey);
  await storage.dock(signed);
  return signed;
}

export async function isDelegationRevoked(vcCid: string, storage: StorageAdapter): Promise<boolean> {
  const revocations = await storage.query({ schema: 'xp0/revocation' });
  return revocations.some((t) => (t.content as Record<string, unknown>).revokedCid === vcCid);
}
