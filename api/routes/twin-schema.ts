import { Router } from 'express';

const DIGITAL_TWIN_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Digital Twin Schema',
  description: 'Schema for agent digital twin representation (§4.A2A.3)',
  type: 'object',
  required: ['identity', 'role', 'project', 'state', 'metadata'],
  additionalProperties: false,
  properties: {
    identity: {
      type: 'object',
      required: ['agent_name', 'api_key', 'session_id'],
      additionalProperties: false,
      properties: {
        agent_name: { type: 'string', description: 'Agent display name' },
        api_key: { type: 'string', description: 'API key for authentication' },
        session_id: { type: 'string', description: 'Current session identifier' },
      },
    },
    role: {
      type: 'object',
      required: ['current', 'capabilities'],
      additionalProperties: false,
      properties: {
        current: {
          type: 'string',
          enum: ['liaison', 'pdsa', 'dev', 'qa'],
          description: 'Current agent role',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent capabilities',
        },
      },
    },
    project: {
      type: 'object',
      required: ['slug', 'branch'],
      additionalProperties: false,
      properties: {
        slug: { type: 'string', description: 'Project slug identifier' },
        branch: { type: 'string', description: 'Current git branch' },
      },
    },
    state: {
      type: 'object',
      required: ['status'],
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: ['idle', 'active', 'blocked', 'disconnected'],
          description: 'Current agent status',
        },
        task: { type: ['string', 'null'], description: 'Current task slug' },
        lease: { type: ['string', 'null'], description: 'Task lease expiry ISO timestamp' },
        heartbeat: { type: ['string', 'null'], description: 'Last heartbeat ISO timestamp' },
        score: { type: ['number', 'null'], description: 'Agent health score (0-1)' },
      },
    },
    metadata: {
      type: 'object',
      required: ['framework'],
      additionalProperties: false,
      properties: {
        framework: { type: 'string', description: 'Agent framework identifier' },
        connected_at: { type: ['string', 'null'], description: 'Connection timestamp' },
        agent_id: { type: ['string', 'null'], description: 'Unique agent identifier' },
      },
    },
  },
};

export const twinSchemaRouter = Router();

twinSchemaRouter.get('/', (_req, res) => {
  res.json(DIGITAL_TWIN_SCHEMA);
});
