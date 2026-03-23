import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
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

// GET /:slug/deployment-readiness — check if project is ready for deployment
projectsRouter.get('/:slug/deployment-readiness', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const openSuspects = db.prepare(
    "SELECT COUNT(*) as count FROM suspect_links WHERE project_slug = ? AND status = 'suspect'"
  ).get(slug) as any;

  const totalSuspects = db.prepare(
    "SELECT COUNT(*) as count FROM suspect_links WHERE project_slug = ?"
  ).get(slug) as any;

  const ready = openSuspects.count === 0;

  res.status(200).json({
    ready,
    open_suspects: openSuspects.count,
    total_suspects: totalSuspects.count
  });
});

// POST / — create project (with optional git_url)
projectsRouter.post('/', (req: Request, res: Response) => {
  const { slug, name, description, git_url } = req.body;
  const user = (req as any).user;

  // UX: if git_url provided without slug/name, derive them from URL
  let projectSlug = slug;
  let projectName = name;
  if (git_url && !projectSlug) {
    // https://github.com/XPollination/xpollination-mindspace.git → xpollination-mindspace
    const match = git_url.match(/\/([^/]+?)(?:\.git)?$/);
    projectSlug = match ? match[1].toLowerCase() : undefined;
  }
  if (git_url && !projectName && projectSlug) {
    projectName = projectSlug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  if (!projectSlug || !projectName) {
    res.status(400).json({ error: 'Missing required fields: slug and name (or provide git_url to auto-derive)' });
    return;
  }

  if (!SLUG_REGEX.test(projectSlug)) {
    res.status(400).json({ error: 'Invalid slug format. Must be lowercase alphanumeric + hyphens, 2-50 chars' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(projectSlug);
  if (existing) {
    res.status(409).json({ error: 'Slug already exists' });
    return;
  }

  const id = randomUUID();
  db.prepare('INSERT INTO projects (id, slug, name, description, git_url, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, projectSlug, projectName, description || null, git_url || null, user.id);

  // Auto-grant admin access to creator
  db.prepare('INSERT OR IGNORE INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, ?, ?, ?)')
    .run(user.id, projectSlug, 'admin', user.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// DELETE /:slug — remove user's access to project (does not delete project data)
projectsRouter.delete('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const result = db.prepare('DELETE FROM project_access WHERE user_id = ? AND project_slug = ?')
    .run(user.id, slug);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Project access not found' });
    return;
  }

  res.status(200).json({ removed: true, slug });
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
