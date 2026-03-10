# PDSA: Digital twin schema endpoint

**Task:** ms-a11-2-twin-schema
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The agent card (ms-a11-1-agent-card) references `digital_twin_schema: 'https://mindspace.xpollination.earth/schemas/digital-twin-v1.json'`. This URL must serve a valid JSON Schema that agents download during bootstrap (step 2 of zero-knowledge bootstrap, §4.A2A.1) to construct their digital twin before connecting.

## Requirements (REQ-A2A-001 §4.A2A.3)

> Serve digital twin JSON schema at /schemas/digital-twin-v1.json. Schema defines all fields from spec Section 4.A2A.3. AC: Schema is valid JSON Schema, documents all twin fields.

### Twin fields from §4.A2A.3

```json
{
  "identity": { "agent_name": "", "api_key": "", "session_id": "" },
  "role": { "current": "", "capabilities": [] },
  "project": { "slug": "", "branch": "" },
  "state": {
    "status": "connecting",
    "current_task_id": null,
    "lease_expires_at": null,
    "last_heartbeat": null,
    "communication_score": null
  },
  "metadata": {
    "framework": "claude-code",
    "framework_version": "",
    "connected_at": null,
    "agent_id": null
  }
}
```

**Spec note:** "The twin travels with every message. The orchestrator updates server-side fields (agent_id, lease, score). The agent updates client-side fields (status, current_task). On each exchange, both sides have the SAME state picture."

## Design

### File: `api/routes/twin-schema.ts`

Static route serving a JSON Schema (draft-07) at `/schemas/digital-twin-v1.json`.

```typescript
import { Router, Request, Response } from 'express';

const TWIN_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://mindspace.xpollination.earth/schemas/digital-twin-v1.json',
  title: 'Digital Twin',
  description: 'Agent digital twin schema for XPollination A2A protocol (§4.A2A.3)',
  type: 'object',
  required: ['identity', 'role', 'project', 'state', 'metadata'],
  properties: {
    identity: {
      type: 'object',
      description: 'Credentials and session tracking',
      required: ['agent_name', 'api_key', 'session_id'],
      properties: {
        agent_name: { type: 'string', description: 'Agent identifier' },
        api_key: { type: 'string', description: 'Authentication token' },
        session_id: { type: 'string', description: 'Current session identifier' }
      },
      additionalProperties: false
    },
    role: {
      type: 'object',
      description: 'Role assignment and capabilities',
      required: ['current', 'capabilities'],
      properties: {
        current: {
          type: 'string',
          enum: ['pdsa', 'dev', 'qa', 'liaison'],
          description: 'Assigned role'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capability strings the agent supports'
        }
      },
      additionalProperties: false
    },
    project: {
      type: 'object',
      description: 'Project context',
      required: ['slug', 'branch'],
      properties: {
        slug: { type: 'string', description: 'Project identifier' },
        branch: { type: 'string', description: 'Git branch for this session' }
      },
      additionalProperties: false
    },
    state: {
      type: 'object',
      description: 'Connection and task state',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['connecting', 'active', 'idle', 'disconnected'],
          description: 'Connection state'
        },
        current_task_id: {
          type: ['string', 'null'],
          description: 'Currently claimed task (null if idle)'
        },
        lease_expires_at: {
          type: ['string', 'null'],
          format: 'date-time',
          description: 'When the current lease expires'
        },
        last_heartbeat: {
          type: ['string', 'null'],
          format: 'date-time',
          description: 'Timestamp of last progress update'
        },
        communication_score: {
          type: ['number', 'null'],
          description: 'Agent communication quality metric'
        }
      },
      additionalProperties: false
    },
    metadata: {
      type: 'object',
      description: 'System-managed fields',
      required: ['framework'],
      properties: {
        framework: {
          type: 'string',
          description: 'Agent execution framework (e.g., claude-code)'
        },
        framework_version: {
          type: 'string',
          description: 'Version of the framework'
        },
        connected_at: {
          type: ['string', 'null'],
          format: 'date-time',
          description: 'Timestamp when agent connected'
        },
        agent_id: {
          type: ['string', 'null'],
          description: 'Server-assigned unique agent identifier'
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(TWIN_SCHEMA);
});

export { router as twinSchemaRouter };
```

### File: `api/server.ts` (update)

Mount the schema route:

```typescript
import { twinSchemaRouter } from './routes/twin-schema.js';
// ...
app.use('/schemas/digital-twin-v1.json', twinSchemaRouter);
```

### Design decisions

1. **Static JSON, not a file on disk** — schema is defined inline in TypeScript for type safety and to avoid needing a static file serving setup.
2. **JSON Schema draft-07** — widely supported, the default for most validators.
3. **`additionalProperties: false`** — strict validation. Agents must use exactly the defined fields.
4. **Nullable fields use type arrays** — `["string", "null"]` for fields that start as null (current_task_id, lease_expires_at, etc.).
5. **Enums for constrained values** — `status` and `role.current` have explicit allowed values.
6. **Public endpoint** — no auth required. Agents fetch this before they have credentials.

## Files Changed

1. `api/routes/twin-schema.ts` — new route with JSON Schema
2. `api/server.ts` — mount at `/schemas/digital-twin-v1.json`

## Testing

1. `twin-schema.ts` file exists with router export
2. Schema has `$schema` field (JSON Schema meta-schema reference)
3. Schema has `$id` matching the agent card's `digital_twin_schema` URL
4. Schema has `title` and `description`
5. Schema requires all 5 top-level sections: identity, role, project, state, metadata
6. `identity` section: requires agent_name, api_key, session_id (all strings)
7. `role` section: requires current (enum: pdsa/dev/qa/liaison) and capabilities (string array)
8. `project` section: requires slug and branch (both strings)
9. `state` section: requires status (enum: connecting/active/idle/disconnected), nullable fields for task_id/lease/heartbeat/score
10. `metadata` section: requires framework (string), nullable fields for connected_at/agent_id
11. `server.ts` imports and mounts twinSchemaRouter at `/schemas/digital-twin-v1.json`
12. Schema uses `additionalProperties: false` on all objects
