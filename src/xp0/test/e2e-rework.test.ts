/**
 * E2E Test: Scenario B — Rework Cycle (SB.1-SB.4)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create, sign, evolve } from '../twin/kernel.js';
import { validateWorkflow } from '../workflow/workflow-engine.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';

let storeDir: string;
let storage: FileStorageAdapter;
let ownerKey: { publicKey: Uint8Array; privateKey: Uint8Array };
let ownerDID: string;
const lifecycle: Record<string, any> = {};

beforeAll(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-e2e-rework-'));
  storage = new FileStorageAdapter(storeDir);
  ownerKey = await generateKeyPair();
  ownerDID = deriveDID(ownerKey.publicKey);

  // Setup: create a task that has been implemented and is at review+qa
  const genesis = await create('object', 'xp0/task', ownerDID, {
    title: 'Rework test task',
    status: 'review',
    role: 'qa',
    implementation: 'Initial buggy implementation',
    logicalId: 'rework-task-1',
  });
  lifecycle.atReview = await sign(genesis, ownerKey.privateKey);
  await storage.dock(lifecycle.atReview);
});

afterAll(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── SB.1: QA rejects implementation ───

describe('SB.1: QA rejects implementation', () => {
  it('QA writes rework_reason and transitions to rework+dev', async () => {
    const reworked = await evolve(lifecycle.atReview, {
      status: 'rework',
      role: 'qa',
      rework_reason: 'Tests fail: expected 200 got 500 on /api/health',
      failing_tests: ['src/xp0/runner/runner.test.ts:42'],
      rework_target_role: 'dev',
    });
    const signed = await sign(reworked, ownerKey.privateKey);
    await storage.dock(signed);

    expect((signed.content as any).rework_reason).toBeDefined();
    expect((signed.content as any).rework_target_role).toBe('dev');

    const wf = validateWorkflow(
      { status: 'review', role: 'qa' },
      { status: 'rework', role: 'qa', rework_target_role: 'dev' }
    );
    expect(wf.valid).toBe(true);
    lifecycle.atRework = signed;
  });
});

// ─── SB.2: Dev fixes in rework ───

describe('SB.2: Dev fixes in rework', () => {
  it('Dev claims rework, reads context, writes updated implementation', async () => {
    // Dev claims: rework → active
    const active = await evolve(lifecycle.atRework, {
      status: 'active',
      role: 'dev',
    });
    const activeSigned = await sign(active, ownerKey.privateKey);
    await storage.dock(activeSigned);
    const fixed = await evolve(activeSigned, {
      status: 'review',
      role: 'dev',
      implementation: 'Fixed implementation — health endpoint returns 200',
      rework_fix: 'Fixed missing error handler in health route',
    });
    const signed = await sign(fixed, ownerKey.privateKey);
    await storage.dock(signed);

    expect((signed.content as any).rework_fix).toBeDefined();
    expect((signed.content as any).implementation).toContain('Fixed');
    lifecycle.resubmitted = signed;
  });
});

// ─── SB.3: QA passes on second review ───

describe('SB.3: QA passes on second review', () => {
  it('QA re-reviews and forwards through review chain', async () => {
    const qaReviewed = await evolve(lifecycle.resubmitted, {
      role: 'pdsa',
      qa_review: 'All tests pass after rework fix',
    });
    const signed = await sign(qaReviewed, ownerKey.privateKey);
    await storage.dock(signed);

    expect((signed.content as any).qa_review).toContain('pass');
    lifecycle.qaReviewed = signed;
  });
});

// ─── SB.4: Rework preserves provenance ───

describe('SB.4: Rework preserves provenance', () => {
  it('full chain from qa-reviewed back to genesis includes rework step', async () => {
    const hist = await storage.history(lifecycle.qaReviewed.cid);
    expect(hist.length).toBeGreaterThanOrEqual(3);

    // Should see the rework in the chain
    const hasRework = hist.some(t => (t.content as any).rework_reason);
    expect(hasRework).toBe(true);

    // Should see the fix in the chain
    const hasFix = hist.some(t => (t.content as any).rework_fix);
    expect(hasFix).toBe(true);
  });
});
