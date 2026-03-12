import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const dataRouter = Router();

dataRouter.use(requireApiKeyOrJwt);

// GET /api/data?project=<slug> — project data with ETag support
dataRouter.get('/', (req: Request, res: Response) => {
  const projectSlug = req.query.project as string;
  const db = getDb();

  if (!projectSlug) {
    res.status(400).json({ error: 'Missing required query param: project' });
    return;
  }

  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(projectSlug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_slug = ? ORDER BY created_at DESC').all(projectSlug);

  const payload = {
    project: project.name,
    project_slug: projectSlug,
    exported_at: new Date().toISOString(),
    tasks
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
