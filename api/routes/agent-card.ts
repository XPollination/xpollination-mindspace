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
