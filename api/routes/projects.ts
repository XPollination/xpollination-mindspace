import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';
import { membersRouter } from './members.js';
import { brainRouter } from './brain.js';
import { agentPoolRouter } from './agent-pool.js';
import { tasksRouter } from './tasks.js';
import { requirementsRouter } from './requirements.js';
import { focusRouter } from './focus.js';
import { featureFlagsRouter } from './feature-flags.js';
import { bugReportsRouter } from './bug-reports.js';
import { releasesRouter } from './releases.js';
import { approvalRequestsRouter } from './approval-requests.js';
import { capabilitiesRouter } from './capabilities.js';
import { missionsRouter } from './missions.js';

export const projectsRouter = Router();

// Slug validation regex: lowercase alphanumeric + hyphens, 2-50 chars
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;

projectsRouter.use(requireApiKeyOrJwt);

// Nested members routes
projectsRouter.use('/:slug/members', membersRouter);

// Nested brain routes
projectsRouter.use('/:slug/brain', brainRouter);

// Nested agent pool routes
projectsRouter.use('/:slug/agents', agentPoolRouter);

// Nested tasks routes
projectsRouter.use('/:slug/tasks', tasksRouter);

// Nested requirements routes
projectsRouter.use('/:slug/requirements', requirementsRouter);

// Nested focus routes
projectsRouter.use('/:slug/focus', focusRouter);

// Nested feature flags routes
projectsRouter.use('/:slug/flags', featureFlagsRouter);

// Nested bug reports routes
projectsRouter.use('/:slug/bugs', bugReportsRouter);

// Nested releases routes
projectsRouter.use('/:slug/releases', releasesRouter);

// Nested approval requests routes
projectsRouter.use('/:slug/approvals', approvalRequestsRouter);

// Nested capabilities routes
projectsRouter.use('/:slug/capabilities', capabilitiesRouter);

// Nested missions routes
projectsRouter.use('/:slug/missions', missionsRouter);

// POST / — create project
projectsRouter.post('/', (req: Request, res: Response) => {
  const { slug, name, description } = req.body;
  const user = (req as any).user;

  if (!slug || !name) {
    res.status(400).json({ error: 'Missing required fields: slug, name' });
    return;
  }

  if (!SLUG_REGEX.test(slug)) {
    res.status(400).json({ error: 'Invalid slug format. Must be lowercase alphanumeric + hyphens, 2-50 chars' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (existing) {
    res.status(409).json({ error: 'Slug already exists' });
    return;
  }

  const id = randomUUID();
  db.prepare('INSERT INTO projects (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, slug, name, description || null, user.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// GET / — list all projects
projectsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.status(200).json(projects);
});

// GET /:slug — get project by slug
projectsRouter.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.status(200).json(project);
});

// PUT /:slug — update project
projectsRouter.put('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const { name, description } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as any;

  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const updatedName = name || existing.name;
  const updatedDescription = description !== undefined ? description : existing.description;

  db.prepare('UPDATE projects SET name = ?, description = ? WHERE slug = ?')
    .run(updatedName, updatedDescription, slug);

  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
  res.status(200).json(project);
});
