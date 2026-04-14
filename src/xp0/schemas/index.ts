export const runnerSchemaV1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'xp0/runner/v0.0.1',
  type: 'object' as const,
  required: [
    'name',
    'principal',
    'owner',
    'roles',
    'workload',
    'hardware',
    'status',
    'maxConcurrent',
    'heartbeatInterval',
  ],
  properties: {
    name: { type: 'string' },
    principal: { type: 'string' },
    owner: { type: 'string' },
    roles: {
      type: 'array',
      items: { type: 'string', enum: ['liaison', 'pdsa', 'qa', 'dev'] },
    },
    workload: {
      type: 'object',
      required: ['type', 'binary', 'mode'],
      properties: {
        type: { type: 'string' },
        binary: { type: 'string' },
        endpoint: { type: 'string' },
        mode: { type: 'string' },
      },
    },
    hardware: {
      type: 'object',
      required: ['location', 'network', 'resources'],
      properties: {
        location: { type: 'string' },
        network: { type: 'string' },
        resources: { type: 'object' },
      },
    },
    status: { type: 'string', enum: ['ready', 'busy', 'draining', 'stopped'] },
    maxConcurrent: { type: 'integer' },
    heartbeatInterval: { type: 'integer' },
    needsSecrets: { type: 'boolean' },
    delegationVC: { type: 'string' },
  },
  additionalProperties: false,
};

export const teamSchemaV1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'xp0/team/v0.0.1',
  type: 'object' as const,
  required: ['project', 'owner', 'agents', 'capacity', 'workflow', 'state'],
  properties: {
    project: { type: 'string' },
    owner: { type: 'string' },
    agents: {
      type: 'array',
      items: {
        type: 'object',
        required: ['role', 'runner'],
        properties: {
          role: { type: 'string' },
          runner: { type: 'string' },
        },
      },
    },
    capacity: {
      type: 'object',
      required: ['max_concurrent_agents', 'available_roles'],
      properties: {
        max_concurrent_agents: { type: 'integer' },
        available_roles: { type: 'array', items: { type: 'string' } },
      },
    },
    workflow: { type: 'string' },
    state: { type: 'string', enum: ['active', 'paused', 'stopped'] },
  },
  additionalProperties: false,
};

export const delegationVcSchemaV1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'xp0/delegation-vc/v0.0.1',
  type: 'object' as const,
  required: ['issuer', 'subject', 'scope', 'valid_from', 'valid_until'],
  properties: {
    issuer: { type: 'string' },
    subject: { type: 'string' },
    scope: {
      type: 'object',
      required: ['operations', 'roles', 'projects'],
      properties: {
        operations: { type: 'array', items: { type: 'string' }, minItems: 1 },
        roles: { type: 'array', items: { type: 'string' } },
        projects: { type: 'array', items: { type: 'string' } },
      },
    },
    valid_from: { type: 'string' },
    valid_until: { type: 'string' },
  },
  additionalProperties: false,
};
