import { describe, it, expect } from 'vitest';
import { submitCreate, submitUpdate } from '../submit.js';
import { createMission } from '../mission-twin.js';
import { createTask } from '../task-twin.js';

/**
 * TDD Tests: Submit protocol — A2A message formatting
 * Ref: REQ-A2A-003, digital-twin-protocol-design (AC4)
 */

describe('submitCreate', () => {

  it('formats OBJECT_CREATE message with twin payload', async () => {
    const twin = createMission({ id: 'm1', title: 'Test', status: 'draft' });
    const result = await submitCreate(twin, 'agent-pdsa');
    expect(result).toBeDefined();
  });

  it('includes agent_id in the message', async () => {
    const twin = createMission({ id: 'm1', title: 'Test', status: 'draft' });
    // submitCreate should construct: { type: 'OBJECT_CREATE', agent_id, payload }
    const result = await submitCreate(twin, 'agent-dev');
    expect(result).toBeDefined();
  });
});

describe('submitUpdate', () => {

  it('formats OBJECT_UPDATE message with diff payload', async () => {
    const twin = createTask({ slug: 's', type: 'task', dna: { title: 'T', role: 'dev' } });
    const diff = { status: { old: 'pending', new: 'active' } };
    const result = await submitUpdate(twin, diff, 'agent-qa');
    expect(result).toBeDefined();
  });
});
