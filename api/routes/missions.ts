import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const missionsRouter = Router({ mergeParams: true });

// GET / — list all missions
missionsRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const db = getDb();
  const missions = db.prepare('SELECT * FROM missions ORDER BY created_at DESC').all();
  res.status(200).json(missions);
});

// GET /:missionId/overview — batched mission overview with all capabilities + progress
missionsRouter.get('/:missionId/overview', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, missionId } = req.params;
  const db = getDb();

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as any;
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  const capabilities = db.prepare(
    'SELECT * FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(missionId) as any[];

  const result = capabilities.map(cap => {
    // Get linked tasks
    const tasks = db.prepare(
      `SELECT ct.task_slug, t.id, t.title, t.status
       FROM capability_tasks ct
       LEFT JOIN tasks t ON t.id = ct.task_slug AND t.project_slug = ?
       WHERE ct.capability_id = ?`
    ).all(slug, cap.id) as any[];

    const total = tasks.length;
    const completeCount = tasks.filter(t => t.status === 'complete').length;
    const progressPercent = total > 0 ? Math.round((completeCount / total) * 100) : 0;

    let dependencyIds: string[] = [];
    try {
      dependencyIds = JSON.parse(cap.dependency_ids || '[]');
    } catch { /* ignore */ }

    return {
      id: cap.id,
      title: cap.title,
      status: cap.status,
      sort_order: cap.sort_order,
      dependency_ids: dependencyIds,
      task_count: total,
      complete_count: completeCount,
      progress_percent: progressPercent
    };
  });

  res.status(200).json({ mission_id: missionId, title: mission.title, capabilities: result });
});
