import { describe, it, expect } from 'vitest';
import { createTask, validateTask, diffTask } from '../task-twin.js';

/**
 * TDD Tests: TaskTwin — create, validate, diff, workflow-engine integration
 * Ref: REQ-A2A-003, digital-twin-protocol-design
 */

describe('createTask', () => {

  it('creates a task twin with required fields', () => {
    const twin = createTask({
      slug: 'my-task', type: 'task', status: 'pending',
      dna: { title: 'My Task', role: 'dev' }
    });
    expect(twin._type).toBe('task');
    expect(twin.slug).toBe('my-task');
    expect(twin.type).toBe('task');
    expect(twin.dna.title).toBe('My Task');
    expect(twin.dna.role).toBe('dev');
  });

  it('defaults status to pending when not provided', () => {
    const twin = createTask({
      slug: 'task-1', type: 'task',
      dna: { title: 'T', role: 'dev' }
    });
    expect(twin.status).toBe('pending');
  });

  it('sets _created_at timestamp', () => {
    const twin = createTask({
      slug: 's', type: 'task',
      dna: { title: 'T', role: 'dev' }
    });
    expect(twin._created_at).toBeDefined();
  });

  it('preserves parent_ids when provided', () => {
    const twin = createTask({
      slug: 's', type: 'task', parent_ids: ['parent-1', 'parent-2'],
      dna: { title: 'T', role: 'dev' }
    });
    expect(twin.parent_ids).toEqual(['parent-1', 'parent-2']);
  });

  it('preserves extra DNA fields', () => {
    const twin = createTask({
      slug: 's', type: 'task',
      dna: { title: 'T', role: 'dev', priority: 'high', group: 'A2A' }
    });
    expect(twin.dna.priority).toBe('high');
    expect(twin.dna.group).toBe('A2A');
  });
});

describe('validateTask', () => {

  it('returns valid for a correct task', () => {
    const twin = createTask({
      slug: 'valid-task', type: 'task', status: 'pending',
      dna: { title: 'Valid', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when slug is empty', () => {
    const twin = createTask({
      slug: '', type: 'task',
      dna: { title: 'T', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('slug'))).toBe(true);
  });

  it('returns error for slug with uppercase', () => {
    const twin = createTask({
      slug: 'Bad-Slug', type: 'task',
      dna: { title: 'T', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('slug'))).toBe(true);
  });

  it('accepts lowercase-with-hyphens slug', () => {
    const twin = createTask({
      slug: 'my-valid-slug', type: 'task',
      dna: { title: 'T', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(true);
  });

  it('returns error for invalid status (AC6: VALID_STATUSES)', () => {
    const twin = createTask({
      slug: 'task-1', type: 'task', status: 'not-a-status',
      dna: { title: 'T', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('status'))).toBe(true);
  });

  it('accepts all valid workflow statuses', () => {
    const validStatuses = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
    for (const status of validStatuses) {
      const twin = createTask({
        slug: 'task-1', type: 'task', status,
        dna: { title: 'T', role: 'dev' }
      });
      const result = validateTask(twin);
      expect(result.valid).toBe(true);
    }
  });

  it('returns error for invalid role (AC6: VALID_ROLES)', () => {
    const twin = createTask({
      slug: 'task-1', type: 'task',
      dna: { title: 'T', role: 'invalid-role' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('role'))).toBe(true);
  });

  it('returns error when dna.title is missing', () => {
    const twin = createTask({
      slug: 'task-1', type: 'task',
      dna: { title: '', role: 'dev' }
    });
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('title'))).toBe(true);
  });

  it('collects multiple errors', () => {
    const twin = { _type: 'task' as const, slug: '', type: '', status: 'bad', dna: { title: '', role: '' } } as any;
    const result = validateTask(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('diffTask', () => {

  it('returns empty diff for identical tasks', () => {
    const a = createTask({ slug: 's', type: 'task', dna: { title: 'T', role: 'dev' } });
    const diff = diffTask(a, a);
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it('detects status change', () => {
    const original = createTask({ slug: 's', type: 'task', status: 'pending', dna: { title: 'T', role: 'dev' } });
    const current = createTask({ slug: 's', type: 'task', status: 'active', dna: { title: 'T', role: 'dev' } });
    const diff = diffTask(current, original);
    expect(diff.status).toEqual({ old: 'pending', new: 'active' });
  });

  it('detects dna.title change', () => {
    const original = createTask({ slug: 's', type: 'task', dna: { title: 'Old', role: 'dev' } });
    const current = createTask({ slug: 's', type: 'task', dna: { title: 'New', role: 'dev' } });
    const diff = diffTask(current, original);
    expect(diff['dna.title'] || diff.dna).toBeDefined();
  });
});
