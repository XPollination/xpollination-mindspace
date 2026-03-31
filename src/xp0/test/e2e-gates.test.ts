/**
 * E2E Test: Scenario E — Quality Gates and Enforcement (SE.1-SE.4)
 *
 * Tests that the full validation stack (twin kernel + workflow engine + transaction validator)
 * correctly rejects invalid transitions and enforces quality gates.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create, sign, evolve } from '../twin/kernel.js';
import { validateWorkflow } from '../workflow/workflow-engine.js';
import { validate as validateTransaction } from '../validation/transaction-validator.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { FileStorageAdapter } from '../storage/file-storage-adapter.js';

let storeDir: string;
let storage: FileStorageAdapter;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'xp0-e2e-gates-'));
  storage = new FileStorageAdapter(storeDir);
});

afterEach(async () => {
  await rm(storeDir, { recursive: true, force: true });
});

// ─── SE.1: Missing pdsa_ref blocks active→approval ───

describe('SE.1: Missing pdsa_ref blocks transition', () => {
  it('PDSA runner trying active→approval without pdsa_ref is REJECTED', () => {
    const from = { status: 'active', role: 'pdsa' };
    const to = {
      status: 'approval',
      role: 'pdsa',
      memory_contribution_id: 'uuid-123',
      // MISSING: pdsa_ref
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/pdsa_ref/i);
  });

  it('PDSA runner with pdsa_ref succeeds', () => {
    const from = { status: 'active', role: 'pdsa' };
    const to = {
      status: 'approval',
      role: 'pdsa',
      pdsa_ref: 'https://github.com/example/pdsa',
      memory_contribution_id: 'uuid-123',
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });
});

// ─── SE.2: Missing human_answer blocks completion ───

describe('SE.2: Missing human_answer blocks completion', () => {
  it('Liaison trying review→complete without human_answer is REJECTED', () => {
    const from = { status: 'review', role: 'liaison' };
    const to = { status: 'complete', role: 'liaison' };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/human_answer/i);
  });

  it('Liaison with full audit trail succeeds', () => {
    const from = { status: 'review', role: 'liaison' };
    const to = {
      status: 'complete',
      role: 'liaison',
      human_answer: 'Approved — implementation verified',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });
});

// ─── SE.3: Invalid transition rejected (skip review chain) ───

describe('SE.3: Invalid transition rejected', () => {
  it('Dev runner trying active→complete (skipping review) is REJECTED', () => {
    const from = { status: 'active', role: 'dev' };
    const to = { status: 'complete', role: 'dev' };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/transition/i);
  });

  it('Dev active→review (correct path) succeeds', () => {
    const from = { status: 'active', role: 'dev' };
    const to = { status: 'review', role: 'dev' };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('Twin evolution with invalid workflow fails full tx validation', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const did = deriveDID(publicKey);

    // Create v1 (active+dev)
    const v1 = await create('object', 'xp0/task', did, {
      title: 'Task',
      status: 'active',
      role: 'dev',
    });
    const v1Signed = await sign(v1, privateKey);
    await storage.dock(v1Signed);

    // Try to evolve directly to complete (invalid)
    const v2 = await evolve(v1Signed, { status: 'complete', role: 'dev' });
    const v2Signed = await sign(v2, privateKey);

    // Full transaction validation should fail at step 5 (workflow)
    const result = await validateTransaction(v2Signed, { storage });
    expect(result.valid).toBe(false);
  });
});

// ─── SE.4: Role consistency enforced ───

describe('SE.4: Role consistency enforced', () => {
  it('Task completing with role=dev instead of role=liaison is REJECTED', () => {
    const from = { status: 'review', role: 'liaison' };
    const to = {
      status: 'complete',
      role: 'dev', // Should be liaison
      human_answer: 'Approved',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });

  it('Task completing with role=liaison succeeds', () => {
    const from = { status: 'review', role: 'liaison' };
    const to = {
      status: 'complete',
      role: 'liaison',
      human_answer: 'Approved',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(true);
  });

  it('approved with role=dev instead of role=qa is REJECTED', () => {
    const from = { status: 'approval', role: 'liaison' };
    const to = {
      status: 'approved',
      role: 'dev', // Should be qa
      human_answer: 'Approved',
      human_answer_at: new Date().toISOString(),
      approval_mode: 'autonomous',
    };
    const result = validateWorkflow(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/role/i);
  });
});

// ─── Bonus: Valid transitions still work after testing rejections ───

describe('Valid transitions still work', () => {
  it('full valid transition chain works after all rejection tests', () => {
    // ready→active
    expect(validateWorkflow({ status: 'ready', role: 'dev' }, { status: 'active', role: 'dev' }).valid).toBe(true);
    // active→review
    expect(validateWorkflow({ status: 'active', role: 'dev' }, { status: 'review', role: 'dev' }).valid).toBe(true);
  });
});
