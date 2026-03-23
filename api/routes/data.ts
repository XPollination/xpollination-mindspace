import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const dataRouter = Router();

dataRouter.use(requireApiKeyOrJwt);

// GET /api/data?project=<slug|all> — project data with ETag support
// Kanban SPA uses project=all to merge data from all projects.
dataRouter.get('/', (req: Request, res: Response) => {
  const projectSlug = req.query.project as string;
  const db = getDb();

  if (!projectSlug) {
    res.status(400).json({ error: 'Missing required query param: project' });
    return;
  }

  let tasks: any[];
  let projectName: string;

  if (projectSlug === 'all') {
    // Merge tasks from all projects
    tasks = db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all();
    projectName = 'All Projects';
  } else {
    const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(projectSlug) as any;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    tasks = db.prepare('SELECT * FROM tasks WHERE project_slug = ? ORDER BY created_at DESC').all(projectSlug);
    projectName = project.name;
  }

  // Format for kanban compatibility: nodes array with slug, status, dna fields
  const nodes = tasks.map((t: any) => {
    let dna: any = {};
    try { dna = JSON.parse(t.dna_json || '{}'); } catch { /* ignore */ }
    return {
      slug: t.slug || t.id,
      type: 'task',
      status: t.status,
      dna: {
        title: t.title || dna.title || t.slug || t.id,
        role: t.current_role || dna.role,
        description: t.description || dna.description,
        group: dna.group,
        priority: dna.priority,
        _project: t.project_slug,
        ...dna,
      },
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  });

  const queueCount = nodes.filter((n: any) => n.status === 'pending' || n.status === 'ready').length;
  const activeCount = nodes.filter((n: any) => n.status === 'active').length;
  const completedCount = nodes.filter((n: any) => ['complete', 'review', 'rework', 'blocked', 'cancelled'].includes(n.status)).length;

  const payload = {
    project: projectName,
    exported_at: new Date().toISOString(),
    node_count: nodes.length,
    queue_count: queueCount,
    active_count: activeCount,
    completed_count: completedCount,
    nodes,
  };

  // Compute ETag from task data (stable across same data)
  const dataForHash = JSON.stringify(tasks);
  const etag = `"${createHash('md5').update(dataForHash).digest('hex')}"`;

  // Check If-None-Match for conditional response
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  res.set('ETag', etag);
  res.status(200).json(payload);
});

