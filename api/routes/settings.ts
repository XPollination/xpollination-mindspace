import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const settingsRouter = Router();

const VALID_MODES = ['auto', 'semi', 'manual'];

settingsRouter.use(requireApiKeyOrJwt);

// GET /liaison-approval-mode — read current mode
settingsRouter.get('/liaison-approval-mode', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT value, updated_by, updated_at FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
  res.status(200).json({
    mode: row?.value || 'manual',
    updated_by: row?.updated_by || 'system',
    updated_at: row?.updated_at || null,
  });
});

// PUT /liaison-approval-mode — update mode
settingsRouter.put('/liaison-approval-mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!mode || !VALID_MODES.includes(mode)) {
    res.status(400).json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` });
    return;
  }

  const db = getDb();
  const actor = (req as any).user?.email || 'api';

  const oldRow = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
  const oldValue = oldRow?.value || null;

  db.prepare("INSERT INTO system_settings_audit (key, old_value, new_value, changed_by) VALUES ('liaison_approval_mode', ?, ?, ?)").run(oldValue, mode, actor);
  db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at) VALUES ('liaison_approval_mode', ?, ?, datetime('now'))").run(mode, actor);

  const row = db.prepare("SELECT value, updated_by, updated_at FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
  res.status(200).json({
    mode: row.value,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  });
});
