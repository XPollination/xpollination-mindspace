import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';
import { taskDependenciesRouter } from './task-dependencies.js';
import { taskTransitionsRouter } from './task-transitions.js';
import { taskClaimingRouter } from './task-claiming.js';

export const tasksRouter = Router({ mergeParams: true });

// Nested dependency routes at /:taskId/dependencies and /:taskId/dependents
tasksRouter.use('/:taskId', taskDependenciesRouter);

// Nested transition routes at /:taskId/transition
tasksRouter.use('/:taskId/transition', taskTransitionsRouter);

// Nested claiming routes at /:taskId/claim
tasksRouter.use(taskClaimingRouter);

const VALID_STATUSES = ['pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete'];
const VALID_ROLES = ['pdsa', 'dev', 'qa', 'liaison'];

// POST / — create task (requires contributor role)
tasksRouter.post('/', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { title, description, requirement_id, status, current_role, feature_flag_name } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  const taskStatus = status || 'pending';
  if (!VALID_STATUSES.includes(taskStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  if (current_role && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid current_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const db = getDb();
  const id = randomUUID();

  // Auto-generate feature flag name if not provided: XPO_FEATURE_ + 8 random hex chars
  const autoFlagName = feature_flag_name || `XPO_FEATURE_${randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  db.prepare(
    `INSERT INTO tasks (id, project_slug, requirement_id, title, description, status, current_role, feature_flag_name, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, requirement_id || null, title, description || null, taskStatus, current_role || null, autoFlagName, user.id);

  // Auto-create feature_flag entry linked to this task
  const flagId = randomUUID();
  db.prepare(
    `INSERT OR IGNORE INTO feature_flags (id, project_slug, flag_name, state, task_id, toggled_by)
     VALUES (?, ?, ?, 'off', ?, ?)`
  ).run(flagId, slug, autoFlagName, id, user.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const feature_flag = db.prepare('SELECT * FROM feature_flags WHERE task_id = ?').get(id);
  res.status(201).json({ ...task as any, feature_flag });
});

// GET / — list tasks for project (optional filters: status, current_role, claimed, blocked, available_only)
tasksRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, current_role, claimed, blocked, available_only, focus } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM tasks WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (current_role) {
    sql += ' AND current_role = ?';
    params.push(current_role);
  }
  if (available_only === 'true') {
    sql += ' AND claimed_by IS NULL AND status != ?';
    params.push('blocked');
  } else {
    if (claimed === 'true') {
      sql += ' AND claimed_by IS NOT NULL';
    } else if (claimed === 'false') {
      sql += ' AND claimed_by IS NULL';
    }
    if (blocked === 'true') {
      sql += ' AND status = ?';
      params.push('blocked');
    } else if (blocked === 'false') {
      sql += ' AND status != ?';
      params.push('blocked');
    }
  }

  // Focus filter: when focus=true, only return tasks within the project_focus scope
  if (focus === 'true') {
    const focusRow = db.prepare('SELECT scope, task_ids FROM project_focus WHERE project_slug = ?').get(slug) as any;
    if (focusRow && focusRow.task_ids) {
      try {
        const focusTaskIds: string[] = JSON.parse(focusRow.task_ids);
        if (focusTaskIds.length > 0) {
          const placeholders = focusTaskIds.map(() => '?').join(',');
          sql += ` AND id IN (${placeholders})`;
          params.push(...focusTaskIds);
        } else {
          sql += ' AND 1 = 0'; // No focus tasks — return empty
        }
      } catch {
        sql += ' AND 1 = 0'; // Invalid JSON — return empty
      }
    } else {
      sql += ' AND 1 = 0'; // No focus set — return empty
    }
  }

  sql += ' ORDER BY created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  res.status(200).json(tasks);
});

// GET /:taskId — get single task
tasksRouter.get('/:taskId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Enrich with requirement info if requirement_id is set
  let requirement = null;
  if (task.requirement_id) {
    requirement = db.prepare(
      'SELECT id, req_id_human, title, status, priority FROM requirements WHERE id = ?'
    ).get(task.requirement_id);
  }

  res.status(200).json({ ...task, requirement });
});

// PUT /:taskId — update task metadata (NOT status)
tasksRouter.put('/:taskId', requireProjectAccess('contributor'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const { title, description, requirement_id, current_role, feature_flag_name } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (current_role !== undefined && current_role !== null && !VALID_ROLES.includes(current_role)) {
    res.status(400).json({ error: `Invalid current_role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description !== undefined ? description : existing.description;
  const updatedRequirementId = requirement_id !== undefined ? requirement_id : existing.requirement_id;
  const updatedRole = current_role !== undefined ? current_role : existing.current_role;
  const updatedFlag = feature_flag_name !== undefined ? feature_flag_name : existing.feature_flag_name;

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, requirement_id = ?, current_role = ?, feature_flag_name = ?, updated_at = datetime('now')
     WHERE id = ? AND project_slug = ?`
  ).run(updatedTitle, updatedDescription, updatedRequirementId, updatedRole, updatedFlag, taskId, slug);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(200).json(task);
});

// DELETE /:taskId — delete task (requires admin role)
tasksRouter.delete('/:taskId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, taskId } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_slug = ?').get(taskId, slug);
  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  db.prepare('DELETE FROM tasks WHERE id = ? AND project_slug = ?').run(taskId, slug);
  res.status(204).send();
});
