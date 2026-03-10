import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

export const agentPoolRouter = Router({ mergeParams: true });

// GET /api/projects/:slug/agents — aggregated agent pool for viz
agentPoolRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const include_disconnected = req.query.include_disconnected === 'true';
  const db = getDb();

  // Check project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Get agents for this project
  let agentsSql = 'SELECT id, name, current_role, status, session_id, connected_at, last_seen FROM agents WHERE project_slug = ?';
  if (!include_disconnected) {
    agentsSql += " AND status != 'disconnected'";
  }
  agentsSql += ' ORDER BY last_seen DESC';

  const agents = db.prepare(agentsSql).all(slug) as any[];

  // Aggregate by_role
  const by_role: Record<string, number> = {};
  for (const agent of agents) {
    const role = agent.current_role || 'unassigned';
    by_role[role] = (by_role[role] || 0) + 1;
  }

  // Aggregate by_status
  const by_status: Record<string, number> = {};
  for (const agent of agents) {
    by_status[agent.status] = (by_status[agent.status] || 0) + 1;
  }

  res.status(200).json({
    project_slug: slug,
    total: agents.length,
    by_role,
    by_status,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      current_role: a.current_role,
      status: a.status,
      current_task: null, // Placeholder — no task/lease tables yet
      connected_at: a.connected_at,
      last_seen: a.last_seen
    }))
  });
});
