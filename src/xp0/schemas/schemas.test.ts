import { describe, it, expect } from 'vitest';
import { runnerSchemaV1, teamSchemaV1, delegationVcSchemaV1 } from './index.js';
import { validateAgainstSchema } from './validator.js';

// ─── AC1: All 3 schemas pass JSON Schema draft-2020-12 validation ───

describe('schema structure', () => {
  it('runnerSchemaV1 has $schema pointing to draft-2020-12', () => {
    expect(runnerSchemaV1.$schema).toContain('2020-12');
  });

  it('teamSchemaV1 has $schema pointing to draft-2020-12', () => {
    expect(teamSchemaV1.$schema).toContain('2020-12');
  });

  it('delegationVcSchemaV1 has $schema pointing to draft-2020-12', () => {
    expect(delegationVcSchemaV1.$schema).toContain('2020-12');
  });

  it('runnerSchemaV1 has type: object', () => {
    expect(runnerSchemaV1.type).toBe('object');
  });

  it('teamSchemaV1 has type: object', () => {
    expect(teamSchemaV1.type).toBe('object');
  });

  it('delegationVcSchemaV1 has type: object', () => {
    expect(delegationVcSchemaV1.type).toBe('object');
  });
});

// ─── AC2: Valid twins pass schema validation ───

describe('valid runner twin', () => {
  it('accepts a valid runner twin content', () => {
    const content = {
      name: 'runner-alice',
      principal: 'did:key:z6MkAlice',
      owner: 'did:key:z6MkOwner',
      roles: ['dev'],
      workload: {
        type: 'claude-code',
        binary: '/usr/local/bin/claude',
        mode: 'print',
      },
      hardware: {
        location: 'hetzner-cx22',
        network: 'vpn',
        resources: { cpu: 2, ram: 8 },
      },
      status: 'ready',
      maxConcurrent: 1,
      heartbeatInterval: 30000,
    };
    const result = validateAgainstSchema(content, runnerSchemaV1);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('valid team twin', () => {
  it('accepts a valid team twin content', () => {
    const content = {
      project: 'mindspace',
      owner: 'did:key:z6MkOwner',
      agents: [
        { role: 'dev', runner: 'bafyrei-runner-cid' },
        { role: 'qa', runner: 'bafyrei-qa-cid' },
      ],
      capacity: {
        max_concurrent_agents: 3,
        available_roles: ['dev', 'qa', 'pdsa'],
      },
      workflow: 'pdsa-standard',
      state: 'active',
    };
    const result = validateAgainstSchema(content, teamSchemaV1);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('valid delegation-vc twin', () => {
  it('accepts a valid delegation VC content', () => {
    const content = {
      issuer: 'did:key:z6MkOwner',
      subject: 'did:key:z6MkRunner',
      scope: {
        operations: ['claim-tasks', 'evolve-tasks'],
        roles: ['dev'],
        projects: ['mindspace'],
      },
      valid_from: '2026-03-31T00:00:00Z',
      valid_until: '2026-04-30T00:00:00Z',
    };
    const result = validateAgainstSchema(content, delegationVcSchemaV1);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ─── AC3: Invalid twins rejected with specific error ───

describe('invalid runner twin', () => {
  it('rejects runner missing name', () => {
    const content = {
      principal: 'did:key:z6MkAlice',
      owner: 'did:key:z6MkOwner',
      roles: ['dev'],
      workload: { type: 'claude-code', binary: '/bin/claude', mode: 'print' },
      hardware: { location: 'local', network: 'lan', resources: {} },
      status: 'ready',
      maxConcurrent: 1,
      heartbeatInterval: 30000,
    };
    const result = validateAgainstSchema(content, runnerSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects runner with invalid status value', () => {
    const content = {
      name: 'runner-1',
      principal: 'did:key:z6Mk1',
      owner: 'did:key:z6Mk2',
      roles: ['dev'],
      workload: { type: 'claude-code', binary: '/bin/claude', mode: 'print' },
      hardware: { location: 'local', network: 'lan', resources: {} },
      status: 'INVALID_STATUS',
      maxConcurrent: 1,
      heartbeatInterval: 30000,
    };
    const result = validateAgainstSchema(content, runnerSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('status'))).toBe(true);
  });

  it('rejects runner with roles not being an array', () => {
    const content = {
      name: 'runner-1',
      principal: 'did:key:z6Mk1',
      owner: 'did:key:z6Mk2',
      roles: 'dev',
      workload: { type: 'claude-code', binary: '/bin/claude', mode: 'print' },
      hardware: { location: 'local', network: 'lan', resources: {} },
      status: 'ready',
      maxConcurrent: 1,
      heartbeatInterval: 30000,
    };
    const result = validateAgainstSchema(content, runnerSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('roles'))).toBe(true);
  });
});

describe('invalid team twin', () => {
  it('rejects team missing project', () => {
    const content = {
      owner: 'did:key:z6MkOwner',
      agents: [],
      capacity: { max_concurrent_agents: 1, available_roles: [] },
      workflow: 'standard',
      state: 'active',
    };
    const result = validateAgainstSchema(content, teamSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('project'))).toBe(true);
  });

  it('rejects team with invalid state', () => {
    const content = {
      project: 'mindspace',
      owner: 'did:key:z6MkOwner',
      agents: [],
      capacity: { max_concurrent_agents: 1, available_roles: [] },
      workflow: 'standard',
      state: 'INVALID_STATE',
    };
    const result = validateAgainstSchema(content, teamSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('state'))).toBe(true);
  });
});

describe('invalid delegation-vc twin', () => {
  it('rejects VC missing issuer', () => {
    const content = {
      subject: 'did:key:z6MkRunner',
      scope: { operations: ['claim'], roles: ['dev'], projects: ['p1'] },
      valid_from: '2026-03-31T00:00:00Z',
      valid_until: '2026-04-30T00:00:00Z',
    };
    const result = validateAgainstSchema(content, delegationVcSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('issuer'))).toBe(true);
  });

  it('rejects VC missing scope', () => {
    const content = {
      issuer: 'did:key:z6MkOwner',
      subject: 'did:key:z6MkRunner',
      valid_from: '2026-03-31T00:00:00Z',
      valid_until: '2026-04-30T00:00:00Z',
    };
    const result = validateAgainstSchema(content, delegationVcSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scope'))).toBe(true);
  });

  it('rejects VC with empty operations in scope', () => {
    const content = {
      issuer: 'did:key:z6MkOwner',
      subject: 'did:key:z6MkRunner',
      scope: { operations: [], roles: ['dev'], projects: ['p1'] },
      valid_from: '2026-03-31T00:00:00Z',
      valid_until: '2026-04-30T00:00:00Z',
    };
    const result = validateAgainstSchema(content, delegationVcSchemaV1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('operations'))).toBe(true);
  });
});

// ─── AC4: Schemas stored as schema-twins with CIDs ───

describe('schema-twin storage', () => {
  it('runnerSchemaV1 has schemaId field', () => {
    expect(runnerSchemaV1.$id || (runnerSchemaV1 as any).schemaId).toBeDefined();
  });

  it('teamSchemaV1 has schemaId field', () => {
    expect(teamSchemaV1.$id || (teamSchemaV1 as any).schemaId).toBeDefined();
  });

  it('delegationVcSchemaV1 has schemaId field', () => {
    expect(delegationVcSchemaV1.$id || (delegationVcSchemaV1 as any).schemaId).toBeDefined();
  });
});
