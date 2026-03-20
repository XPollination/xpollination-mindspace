import { describe, it, expect } from 'vitest';
import { createRequirement, validateRequirement, diffRequirement } from '../requirement-twin.js';

/**
 * TDD Tests: RequirementTwin — create, validate, diff
 * Ref: REQ-A2A-003, digital-twin-protocol-design
 */

describe('createRequirement', () => {

  it('creates a requirement twin with required fields', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'mcp-server', req_id_human: 'REQ-A2A-001',
      title: 'Test Req', status: 'draft', priority: 'high'
    });
    expect(twin._type).toBe('requirement');
    expect(twin.id).toBe('r1');
    expect(twin.req_id_human).toBe('REQ-A2A-001');
    expect(twin.priority).toBe('high');
  });

  it('sets _created_at timestamp', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'R', status: 'draft', priority: 'medium'
    });
    expect(twin._created_at).toBeDefined();
  });
});

describe('validateRequirement', () => {

  it('returns valid for correct requirement', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'mcp', req_id_human: 'REQ-A2A-003',
      title: 'Valid Req', status: 'active', priority: 'high'
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when project_slug is missing', () => {
    const twin = createRequirement({
      id: 'r1', req_id_human: 'REQ-A2A-001',
      title: 'R', status: 'draft', priority: 'low'
    } as any);
    twin.project_slug = '';
    const result = validateRequirement(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('project_slug'))).toBe(true);
  });

  it('returns error when req_id_human does not match pattern', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'BAD-FORMAT',
      title: 'R', status: 'draft', priority: 'low'
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('REQ-'))).toBe(true);
  });

  it('accepts valid req_id_human patterns', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-002',
      title: 'R', status: 'active', priority: 'critical'
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(true);
  });

  it('returns error for invalid status', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'R', status: 'complete' as any, priority: 'high'
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('status'))).toBe(true);
  });

  it('returns error for invalid priority', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'R', status: 'draft', priority: 'urgent' as any
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('priority'))).toBe(true);
  });

  it('returns error when title exceeds 200 chars', () => {
    const twin = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'x'.repeat(201), status: 'draft', priority: 'low'
    });
    const result = validateRequirement(twin);
    expect(result.valid).toBe(false);
  });
});

describe('diffRequirement', () => {

  it('returns empty diff for identical requirements', () => {
    const a = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'Same', status: 'draft', priority: 'low'
    });
    const diff = diffRequirement(a, a);
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it('detects priority and status changes', () => {
    const original = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'R', status: 'draft', priority: 'low'
    });
    const current = createRequirement({
      id: 'r1', project_slug: 'p', req_id_human: 'REQ-OG-001',
      title: 'R', status: 'active', priority: 'high'
    });
    const diff = diffRequirement(current, original);
    expect(diff.status).toEqual({ old: 'draft', new: 'active' });
    expect(diff.priority).toEqual({ old: 'low', new: 'high' });
  });
});
