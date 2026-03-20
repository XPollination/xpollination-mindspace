import { describe, it, expect } from 'vitest';
import { createMission, validateMission, diffMission } from '../mission-twin.js';

/**
 * TDD Tests: MissionTwin — create, validate, diff
 * Ref: REQ-A2A-003, digital-twin-protocol-design
 */

describe('createMission', () => {

  it('creates a mission twin with required fields', () => {
    const twin = createMission({ id: 'mission-1', title: 'Test Mission', status: 'draft' });
    expect(twin._type).toBe('mission');
    expect(twin.id).toBe('mission-1');
    expect(twin.title).toBe('Test Mission');
    expect(twin.status).toBe('draft');
  });

  it('sets _type to mission automatically', () => {
    const twin = createMission({ id: 'm1', title: 'M1', status: 'active' });
    expect(twin._type).toBe('mission');
  });

  it('sets _created_at timestamp on create', () => {
    const twin = createMission({ id: 'm1', title: 'M1', status: 'draft' });
    expect(twin._created_at).toBeDefined();
    expect(() => new Date(twin._created_at!)).not.toThrow();
  });

  it('preserves optional fields when provided', () => {
    const twin = createMission({
      id: 'm1', title: 'M1', status: 'active',
      description: 'A description', slug: 'my-slug', content_md: '# Content'
    });
    expect(twin.description).toBe('A description');
    expect(twin.slug).toBe('my-slug');
    expect(twin.content_md).toBe('# Content');
  });
});

describe('validateMission', () => {

  it('returns valid for a correct mission', () => {
    const twin = createMission({ id: 'm1', title: 'Valid', status: 'active' });
    const result = validateMission(twin);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when id is missing', () => {
    const twin = createMission({ title: 'No ID', status: 'draft' } as any);
    twin.id = '';
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('id'))).toBe(true);
  });

  it('returns error when title is missing', () => {
    const twin = createMission({ id: 'm1', status: 'draft' } as any);
    twin.title = '';
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('title'))).toBe(true);
  });

  it('returns error when title exceeds 200 chars', () => {
    const twin = createMission({ id: 'm1', title: 'x'.repeat(201), status: 'draft' });
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('200'))).toBe(true);
  });

  it('returns error for invalid status', () => {
    const twin = createMission({ id: 'm1', title: 'M', status: 'invalid' as any });
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('status'))).toBe(true);
  });

  it('returns error when description exceeds 2000 chars', () => {
    const twin = createMission({ id: 'm1', title: 'M', status: 'draft', description: 'x'.repeat(2001) });
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('2000'))).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const twin = { _type: 'mission' as const, id: '', title: '', status: 'bad' } as any;
    const result = validateMission(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('diffMission', () => {

  it('returns empty diff for identical missions', () => {
    const a = createMission({ id: 'm1', title: 'Same', status: 'draft' });
    const diff = diffMission(a, a);
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it('detects title change', () => {
    const original = createMission({ id: 'm1', title: 'Old', status: 'draft' });
    const current = createMission({ id: 'm1', title: 'New', status: 'draft' });
    const diff = diffMission(current, original);
    expect(diff.title).toEqual({ old: 'Old', new: 'New' });
  });

  it('detects status change', () => {
    const original = createMission({ id: 'm1', title: 'M', status: 'draft' });
    const current = createMission({ id: 'm1', title: 'M', status: 'active' });
    const diff = diffMission(current, original);
    expect(diff.status).toEqual({ old: 'draft', new: 'active' });
  });

  it('only includes changed fields', () => {
    const original = createMission({ id: 'm1', title: 'Old', status: 'draft', description: 'same' });
    const current = createMission({ id: 'm1', title: 'New', status: 'draft', description: 'same' });
    const diff = diffMission(current, original);
    expect(diff.title).toBeDefined();
    expect(diff.description).toBeUndefined();
    expect(diff.status).toBeUndefined();
  });
});
