import { Router } from 'express';
import { addConnection, removeConnection } from '../lib/sse-manager.js';
import { getDb } from '../db/connection.js';

const a2aStreamRouter = Router();

// SSE stream endpoint — agents connect here to receive push messages
a2aStreamRouter.get('/:agent_id', (req, res) => {
  const { agent_id } = req.params;

  // Auth check: verify agent exists and is not disconnected
  const db = getDb();
  const agent = db.prepare("SELECT id, current_role, project_slug, can_stream, device_key_id FROM agents WHERE id = ? AND status != 'disconnected'").get(agent_id) as any;
  if (!agent) {
    // Allow special IDs for UI clients (liaison-chat, kanban)
    if (!['liaison-chat', 'kanban-ui'].includes(agent_id)) {
      res.status(404).json({ error: 'Agent not found or disconnected' });
      return;
    }
  }

  // Capability gate: only agents with can_stream capability can open SSE.
  // Capability is assigned server-side at connect time based on auth method.
  // See api/routes/SECURITY.md for the full security model.
  if (agent && !agent.can_stream) {
    res.status(403).json({
      type: 'ERROR',
      error: 'This agent does not have streaming capability. ' +
             'SSE streams are managed by the A2A body (xpo-agent). ' +
             'Task events are delivered to your terminal automatically. ' +
             'To send results: node scripts/a2a-deliver.js --slug <SLUG> --transition <STATUS> --role <ROLE>'
    });
    return;
  }

  // Register SSE connection with role + device key metadata
  addConnection(agent_id, res, agent?.current_role || null, agent?.project_slug || null, agent?.device_key_id || null);

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
