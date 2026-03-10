# PDSA: Agent Card endpoint (/.well-known/agent.json)

**Task:** ms-a11-1-agent-card
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-A2A-001

## Problem

The A2A (Agent-to-Agent) protocol requires a discovery mechanism. Agents fetch `/.well-known/agent.json` to learn the orchestrator's capabilities, auth method, endpoints, and digital twin schema URL. This is the first step in the A2A connection flow.

### Acceptance Criteria (from DNA)

GET `/.well-known/agent.json` returns valid Agent Card JSON.

## Design

### Change A: Agent Card route — `api/routes/agent-card.ts`

```typescript
import { Router } from 'express';

const agentCardRouter = Router();

// Per REQ-A2A-001 §4.A2A.6 — Agent Card discovery endpoint
const AGENT_CARD = {
  name: 'Mindspace Orchestrator',
  description: 'XPollination task orchestration and agent coordination',
  version: '1.0',
  protocol: 'xpo-a2a-v1',
  capabilities: [
    'task_management',
    'requirement_crud',
    'focus_control',
    'transitions',
    'feature_flags',
    'marketplace'
  ],
  authentication: {
    type: 'api_key',
    header: 'X-API-Key',
    registration_url: 'https://mindspace.xpollination.earth/register'
  },
  endpoints: {
    connect: 'https://mindspace.xpollination.earth/a2a/connect',
    message: 'https://mindspace.xpollination.earth/a2a/message',
    stream: 'https://mindspace.xpollination.earth/a2a/stream/{agent_id}'
  },
  digital_twin_schema: 'https://mindspace.xpollination.earth/schemas/digital-twin-v1.json',
  available_projects: 'https://mindspace.xpollination.earth/api/projects'
};

agentCardRouter.get('/', (_req, res) => {
  res.json(AGENT_CARD);
});

export { agentCardRouter };
```

**Design decisions:**
- **Static JSON object** — the Agent Card is configuration, not dynamic data. Defined as a constant, served directly.
- **Exact spec from REQ-A2A-001 §4.A2A.6** — content matches the requirement document verbatim.
- **No auth required** — the Agent Card is a public discovery endpoint. Agents must be able to fetch it without credentials (credentials are obtained via the registration URL in the card).
- **No database dependency** — this endpoint is self-contained.

### Change B: Wire into server — `api/server.ts`

```typescript
import { agentCardRouter } from './routes/agent-card.js';

// Agent Card — A2A discovery (no auth, public)
app.use('/.well-known/agent.json', agentCardRouter);
```

**Note:** Express handles the `.well-known` path naturally. No special config needed for the dot-prefixed directory.

### Files Changed

1. `api/routes/agent-card.ts` — **new** — Agent Card endpoint with static JSON
2. `api/server.ts` — **modified** — register agentCardRouter at `/.well-known/agent.json`

### Testing

1. `GET /.well-known/agent.json` returns 200 with `Content-Type: application/json`
2. Response contains `name: "Mindspace Orchestrator"`
3. Response contains `protocol: "xpo-a2a-v1"`
4. Response contains `version: "1.0"`
5. Response contains all 6 capabilities: task_management, requirement_crud, focus_control, transitions, feature_flags, marketplace
6. Response contains `authentication.type: "api_key"`
7. Response contains `authentication.header: "X-API-Key"`
8. Response contains `endpoints.connect`, `endpoints.message`, `endpoints.stream`
9. Response contains `digital_twin_schema` URL
10. Response contains `available_projects` URL
11. No authentication required to access endpoint
12. Response is valid JSON (parseable)
