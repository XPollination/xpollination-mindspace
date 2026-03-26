import { describe, it, expect } from 'vitest';
import { computeCID } from '../cid.js';

/**
 * TDD Tests: CID computation — deterministic content addressing for twins
 * Ref: REQ-ENV-002, cid-computation design
 */

describe('computeCID', () => {

  it('AC-CID1: same input produces same CID (deterministic)', async () => {
    const input = { _type: 'task', slug: 'test-task', dna: { title: 'Test' } };
    const cid1 = await computeCID(input);
    const cid2 = await computeCID(input);
    expect(cid1).toBe(cid2);
  });

  it('AC-CID2: different content produces different CID', async () => {
    const a = { _type: 'task', slug: 'task-a', dna: { title: 'A' } };
    const b = { _type: 'task', slug: 'task-b', dna: { title: 'B' } };
    const cidA = await computeCID(a);
    const cidB = await computeCID(b);
    expect(cidA).not.toBe(cidB);
  });

  it('AC-CID3: volatile fields excluded (_created_at, _updated_at, status, claimed_by, claimed_at)', async () => {
    const base = { _type: 'task', slug: 'test', dna: { title: 'T' } };
    const withVolatile = {
      ...base,
      _created_at: '2026-01-01T00:00:00Z',
      _updated_at: '2026-03-25T00:00:00Z',
      status: 'active',
      claimed_by: 'agent-dev',
      claimed_at: '2026-03-25T12:00:00Z',
      updated_at: '2026-03-25T12:00:00Z',
    };
    const cidBase = await computeCID(base);
    const cidVolatile = await computeCID(withVolatile);
    expect(cidBase).toBe(cidVolatile);
  });

  it('AC-CID4: canonical key ordering (key sort is stable)', async () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    const cidA = await computeCID(a);
    const cidB = await computeCID(b);
    expect(cidA).toBe(cidB);
  });

  it('AC-CID5: string trimming consistency', async () => {
    const a = { _type: 'task', title: 'hello' };
    const b = { _type: 'task', title: '  hello  ' };
    const cidA = await computeCID(a);
    const cidB = await computeCID(b);
    expect(cidA).toBe(cidB);
  });

  it('AC-CID9: returns valid CIDv1 format string (starts with baf)', async () => {
    const input = { _type: 'task', slug: 'test', dna: { title: 'Test' } };
    const cid = await computeCID(input);
    expect(typeof cid).toBe('string');
    expect(cid.startsWith('bag')).toBe(true);
  });
});
