import { Router } from 'express';
import { addConnection, removeConnection } from '../lib/sse-manager.js';

const a2aStreamRouter = Router();

// SSE stream endpoint — agents connect here to receive push messages
a2aStreamRouter.get('/:agent_id', (req, res) => {
  const { agent_id } = req.params;

  // Register SSE connection
  addConnection(agent_id, res);

  // Clean up on client disconnect
  req.on('close', () => {
    removeConnection(agent_id);
  });

  // Prevent Express from closing the response
  req.on('error', () => {
    removeConnection(agent_id);
  });
});

export { a2aStreamRouter };
