import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const settingsRouter = Router();

const VALID_MODES = ['manual', 'semi', 'auto-approval', 'autonomous'];

settingsRouter.use(requireApiKeyOrJwt);

// GET /liaison-approval-mode — read mode (scoped: user+project > user > system)
settingsRouter.get('/liaison-approval-mode', (req: Request, res: Response) => {
  const db = getDb();
  const user = (req as any).user;
  const project = req.query.project as string | undefined;

  // Try user+project scoped setting first
  if (user?.id && project) {
    const userProjectRow = db.prepare(
      "SELECT value, updated_at FROM user_project_settings WHERE user_id = ? AND project_slug = ? AND key = 'liaison_approval_mode'"
    ).get(user.id, project) as any;
    if (userProjectRow) {
      res.status(200).json({ mode: userProjectRow.value, scope: 'user+project', updated_at: userProjectRow.updated_at });
      return;
    }
  }

  // Try user-level setting (no project)
  if (user?.id) {
    const userRow = db.prepare(
      "SELECT value, updated_at FROM user_project_settings WHERE user_id = ? AND project_slug IS NULL AND key = 'liaison_approval_mode'"
    ).get(user.id) as any;
    if (userRow) {
      res.status(200).json({ mode: userRow.value, scope: 'user', updated_at: userRow.updated_at });
      return;
    }
  }

  // Fallback to system default
  const row = db.prepare("SELECT value, updated_by, updated_at FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
  res.status(200).json({
    mode: row?.value || 'manual',
    scope: 'system',
    updated_by: row?.updated_by || 'system',
    updated_at: row?.updated_at || null,
  });
});

// PUT /liaison-approval-mode — update mode (scoped per user+project)
settingsRouter.put('/liaison-approval-mode', (req: Request, res: Response) => {
  const { mode, project } = req.body;
  if (!mode || !VALID_MODES.includes(mode)) {
    res.status(400).json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` });
    return;
  }

  const db = getDb();
  const user = (req as any).user;
  const userId = user?.id || 'system';

  if (project) {
    // Store as user+project scoped setting
    db.prepare(
      "INSERT OR REPLACE INTO user_project_settings (user_id, project_slug, key, value, updated_at) VALUES (?, ?, 'liaison_approval_mode', ?, datetime('now'))"
    ).run(userId, project, mode);
  } else {
    // Store as user-level default
    db.prepare(
      "INSERT OR REPLACE INTO user_project_settings (user_id, project_slug, key, value, updated_at) VALUES (?, NULL, 'liaison_approval_mode', ?, datetime('now'))"
    ).run(userId, mode);
  }

  // Also update system_settings for backward compatibility
  const actor = user?.email || 'api';
  try {
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at) VALUES ('liaison_approval_mode', ?, ?, datetime('now'))").run(mode, actor);
  } catch { /* system_settings may not exist in all envs */ }

  res.status(200).json({ mode, scope: project ? 'user+project' : 'user', project: project || null });
});
