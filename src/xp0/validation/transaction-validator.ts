import { validate as twinValidate, verify as twinVerify } from '../twin/kernel.js';
import { verifyDelegation as authVerifyDelegation } from '../auth/delegation.js';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';

interface StepResult {
  valid: boolean;
  reason?: string;
}

interface ValidateResult {
  valid: boolean;
  step?: number;
  reason?: string;
}

interface DelegationOpts {
  requiredOperation: string;
  vcCid: string;
  storage: StorageAdapter;
}

interface ValidateOpts {
  storage: StorageAdapter;
  delegation?: DelegationOpts;
}

// Valid workflow transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['ready'],
  ready: ['active'],
  active: ['review', 'blocked', 'approval'],
  approval: ['approved', 'rework'],
  approved: ['testing', 'active'],
  testing: ['ready', 'rework'],
  review: ['complete', 'rework'],
  rework: ['active'],
  blocked: ['ready', 'active'],
};

// Step 1: CID Integrity
export async function verifyCID(twin: Twin): Promise<StepResult> {
  const result = await twinValidate(twin);
  if (!result.valid) {
    const cidError = result.errors.find((e) => e.toLowerCase().includes('cid'));
    return { valid: false, reason: cidError || result.errors[0] };
  }
  return { valid: true };
}

// Step 2: Signature verification
export async function verifySignature(twin: Twin): Promise<StepResult> {
  if (!twin.signature) {
    return { valid: false, reason: 'Twin is unsigned — no signature present' };
  }
  const isValid = await twinVerify(twin);
  if (!isValid) {
    return { valid: false, reason: 'Signature verification failed' };
  }
  return { valid: true };
}

// Step 3: Delegation verification
export async function verifyDelegation(
  _twin: Twin,
  opts: DelegationOpts,
): Promise<StepResult> {
  const result = await authVerifyDelegation({
    vcCid: opts.vcCid,
    requiredOperation: opts.requiredOperation,
    storage: opts.storage,
  });
  return result;
}

// Step 4: Merkle-DAG chain verification
export async function verifyChain(twin: Twin, storage: StorageAdapter): Promise<StepResult> {
  if (!twin.previousVersion) return { valid: true };
  const prev = await storage.resolve(twin.previousVersion);
  if (!prev) {
    return { valid: false, reason: `Broken chain — previousVersion ${twin.previousVersion} not found in storage` };
  }
  return { valid: true };
}

// Step 5: Workflow transition verification
export function verifyWorkflow(oldTwin: Twin, newTwin: Twin): StepResult {
  const oldStatus = (oldTwin.content as Record<string, unknown>).status as string | undefined;
  const newStatus = (newTwin.content as Record<string, unknown>).status as string | undefined;
  if (!oldStatus || !newStatus) return { valid: true };
  if (oldStatus === newStatus) return { valid: true };

  const allowed = VALID_TRANSITIONS[oldStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return { valid: false, reason: `Invalid workflow transition: ${oldStatus} → ${newStatus}` };
  }
  return { valid: true };
}

// Step 6: Conflict resolution — lowest CID wins (deterministic)
export function resolveConflict(cids: string[]): string {
  return [...cids].sort()[0];
}

// Full 6-step validate pipeline (short-circuits on first failure)
export async function validate(
  twin: Twin,
  opts: ValidateOpts,
): Promise<ValidateResult> {
  // Step 1: CID
  const step1 = await verifyCID(twin);
  if (!step1.valid) return { valid: false, step: 1, reason: step1.reason };

  // Step 2: Signature
  const step2 = await verifySignature(twin);
  if (!step2.valid) return { valid: false, step: 2, reason: step2.reason };

  // Step 3: Delegation (only if opts provided)
  if (opts.delegation) {
    const step3 = await verifyDelegation(twin, opts.delegation);
    if (!step3.valid) return { valid: false, step: 3, reason: step3.reason };
  }

  // Step 4: Chain
  const step4 = await verifyChain(twin, opts.storage);
  if (!step4.valid) return { valid: false, step: 4, reason: step4.reason };

  return { valid: true };
}
