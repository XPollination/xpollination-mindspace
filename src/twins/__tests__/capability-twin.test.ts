import { describe, it, expect } from 'vitest';
import { createCapability, validateCapability, diffCapability } from '../capability-twin.js';

/**
 * TDD Tests: CapabilityTwin — create, validate, diff
 * Ref: REQ-A2A-003, digital-twin-protocol-design
 */

describe('createCapability', () => {

  it('creates a capability twin with required fields', () => {
    const twin = createCapability({ id: 'cap-1', mission_id: 'm1', title: 'Auth', status: 'draft' });
    expect(twin._type).toBe('capability');
    expect(twin.id).toBe('cap-1');
    expect(twin.mission_id).toBe('m1');
    expect(twin.title).toBe('Auth');
  });

  it('sets _created_at timestamp', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'draft' });
    expect(twin._created_at).toBeDefined();
  });

  it('preserves optional fields', () => {
    const twin = createCapability({
      id: 'c1', mission_id: 'm1', title: 'C', status: 'active',
      description: 'desc', dependency_ids: ['c2'], sort_order: 3, content_md: '# Cap'
    });
    expect(twin.description).toBe('desc');
    expect(twin.dependency_ids).toEqual(['c2']);
    expect(twin.sort_order).toBe(3);
    expect(twin.content_md).toBe('# Cap');
  });
});

describe('validateCapability', () => {

  it('returns valid for correct capability', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'Valid', status: 'active' });
    const result = validateCapability(twin);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when mission_id is missing', () => {
    const twin = createCapability({ id: 'c1', title: 'C', status: 'draft' } as any);
    twin.mission_id = '';
    const result = validateCapability(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('mission_id'))).toBe(true);
  });

  it('returns error when title exceeds 200 chars', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'x'.repeat(201), status: 'draft' });
    const result = validateCapability(twin);
    expect(result.valid).toBe(false);
  });

  it('returns error for invalid status', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'unknown' as any });
    const result = validateCapability(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('status'))).toBe(true);
  });

  it('returns error when sort_order is negative', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'draft', sort_order: -1 });
    const result = validateCapability(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('sort_order'))).toBe(true);
  });

  it('accepts sort_order of 0', () => {
    const twin = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'draft', sort_order: 0 });
    const result = validateCapability(twin);
    expect(result.valid).toBe(true);
  });
});

describe('diffCapability', () => {

  it('returns empty diff for identical capabilities', () => {
    const a = createCapability({ id: 'c1', mission_id: 'm1', title: 'Same', status: 'draft' });
    const diff = diffCapability(a, a);
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it('detects title and status changes', () => {
    const original = createCapability({ id: 'c1', mission_id: 'm1', title: 'Old', status: 'draft' });
    const current = createCapability({ id: 'c1', mission_id: 'm1', title: 'New', status: 'active' });
    const diff = diffCapability(current, original);
    expect(diff.title).toEqual({ old: 'Old', new: 'New' });
    expect(diff.status).toEqual({ old: 'draft', new: 'active' });
  });

  it('only includes changed fields', () => {
    const original = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'draft' });
    const current = createCapability({ id: 'c1', mission_id: 'm1', title: 'C', status: 'active' });
    const diff = diffCapability(current, original);
    expect(diff.status).toBeDefined();
    expect(diff.title).toBeUndefined();
    expect(diff.id).toBeUndefined();
  });
});
