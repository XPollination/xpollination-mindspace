/**
 * Workspace management — git clone projects for Theia IDE
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../db/connection.js';

export const workspacesRouter = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/home/theia/workspaces';

// POST / — clone a git repo to workspace
workspacesRouter.post('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }

  const { git_url, branch } = req.body;
  if (!git_url) { res.status(400).json({ error: 'git_url is required' }); return; }
  if (!/^https?:\/\/.+\.git$/.test(git_url) && !/^git@.+:.+\.git$/.test(git_url)) {
    res.status(400).json({ error: 'Invalid git URL format' });
    return;
  }

  const repoName = git_url.split('/').pop()?.replace('.git', '') || 'repo';
  const userId = user.id || user.user_id;
  const userDir = resolve(WORKSPACE_ROOT, userId);
  const clonePath = resolve(userDir, repoName);

  if (existsSync(clonePath)) {
    res.status(409).json({ error: `Workspace already exists: ${repoName}` });
    return;
  }

  // Validate branch name if provided
  if (branch && !/^[a-zA-Z0-9\-_.\/]+$/.test(branch)) {
    res.status(400).json({ error: 'Invalid branch name' });
    return;
  }

  try {
    mkdirSync(userDir, { recursive: true });
    const args = ['clone', '--depth', '1'];
    if (branch) { args.push('--branch', branch); }
    args.push(git_url, clonePath);
    execFileSync('git', args, { timeout: 120000, stdio: 'pipe' });
  } catch (err: any) {
    res.status(500).json({ error: `Clone failed: ${err.message}` });
    return;
  }

  const db = getDb();
  const id = randomUUID();
  try {
    db.prepare('CREATE TABLE IF NOT EXISTS user_workspaces (id TEXT PRIMARY KEY, user_id TEXT, repo_name TEXT, git_url TEXT, local_path TEXT, created_at TEXT DEFAULT (datetime(\'now\')))').run();
    db.prepare('INSERT INTO user_workspaces (id, user_id, repo_name, git_url, local_path) VALUES (?, ?, ?, ?, ?)').run(id, userId, repoName, git_url, clonePath);
  } catch { /* table creation race */ }

  res.status(201).json({ id, repo_name: repoName, path: clonePath, status: 'cloned' });
});

// GET / — list user workspaces
workspacesRouter.get('/', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM user_workspaces WHERE user_id = ? ORDER BY created_at DESC').all(user.id || user.user_id);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// DELETE /:id — remove workspace
workspacesRouter.delete('/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) { res.status(401).json({ error: 'Auth required' }); return; }
  const db = getDb();
  try {
    const ws = db.prepare('SELECT * FROM user_workspaces WHERE id = ? AND user_id = ?').get(req.params.id, user.id || user.user_id) as any;
    if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }
    // Remove from DB only — don't delete files (safety)
    db.prepare('DELETE FROM user_workspaces WHERE id = ?').run(req.params.id);
    res.status(200).json({ id: req.params.id, status: 'removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
