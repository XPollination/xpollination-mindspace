import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { getDb } from '../db/connection.js';
import { requireProjectAccess } from '../middleware/require-project-access.js';

export const releasesRouter = Router({ mergeParams: true });

// POST / — create release (admin only)
releasesRouter.post('/', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = (req as any).user;
  const { version } = req.body;

  if (!version) {
    res.status(400).json({ error: 'Missing required field: version' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM releases WHERE project_slug = ? AND version = ?').get(slug, version);
  if (existing) {
    res.status(409).json({ error: 'Release version already exists' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO releases (id, project_slug, version, status, created_by) VALUES (?, ?, ?, 'draft', ?)`
  ).run(id, slug, version, user.id);

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(id);
  res.status(201).json(release);
});

// GET / — list releases for project
releasesRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status } = req.query;
  const db = getDb();

  let sql = 'SELECT * FROM releases WHERE project_slug = ?';
  const params: any[] = [slug];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';
  const releases = db.prepare(sql).all(...params);
  res.status(200).json(releases);
});

// GET /:releaseId — get single release
releasesRouter.get('/:releaseId', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const db = getDb();

  const release = db.prepare('SELECT * FROM releases WHERE id = ? AND project_slug = ?').get(releaseId, slug);
  if (!release) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  res.status(200).json(release);
});

// GET /:releaseId/manifest — generate release manifest
releasesRouter.get('/:releaseId/manifest', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const db = getDb();

  const release = db.prepare('SELECT * FROM releases WHERE id = ? AND project_slug = ?').get(releaseId, slug) as any;
  if (!release) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  // Get complete tasks for the project
  const tasks = db.prepare(
    "SELECT * FROM tasks WHERE project_slug = ? AND status = 'complete'"
  ).all(slug) as any[];

  // Aggregate linked requirements (deduped)
  const reqIds = [...new Set(tasks.map(t => t.requirement_id).filter(Boolean))];
  const requirements = reqIds.length > 0
    ? db.prepare(
        `SELECT * FROM requirements WHERE id IN (${reqIds.map(() => '?').join(',')})`
      ).all(...reqIds)
    : [];

  // Include all feature flags with states
  const flags = db.prepare(
    'SELECT * FROM feature_flags WHERE project_slug = ?'
  ).all(slug);

  const git_tag = `v${release.version}`;
  const generated_at = new Date().toISOString();

  res.status(200).json({
    release,
    tasks,
    requirements,
    flags,
    metadata: { git_tag, generated_at }
  });
});

// PUT /:releaseId — update release (admin only)
releasesRouter.put('/:releaseId', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const user = (req as any).user;
  const { status } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM releases WHERE id = ? AND project_slug = ?').get(releaseId, slug) as any;
  if (!existing) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  // Immutability guard: cannot modify sealed releases
  if (existing.status === 'sealed') {
    res.status(403).json({ error: 'Cannot modify a sealed release — immutable after sealing' });
    return;
  }

  if (status === 'sealed') {
    db.prepare(
      `UPDATE releases SET status = 'sealed', sealed_at = datetime('now'), sealed_by = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(user.id, releaseId);
  } else if (status) {
    db.prepare(
      `UPDATE releases SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, releaseId);
  }

  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);
  res.status(200).json(release);
});

// POST /:releaseId/seal — seal a release (human gate)
// Release must be in 'testing' status to seal
releasesRouter.post('/:releaseId/seal', requireProjectAccess('admin'), (req: Request, res: Response) => {
  const { slug, releaseId } = req.params;
  const user = (req as any).user;
  const db = getDb();

  const release = db.prepare('SELECT * FROM releases WHERE id = ? AND project_slug = ?').get(releaseId, slug) as any;
  if (!release) {
    res.status(404).json({ error: 'Release not found' });
    return;
  }

  if (release.status !== 'testing') {
    res.status(400).json({ error: `Cannot seal: release must be in 'testing' status, currently '${release.status}'` });
    return;
  }

  // Seal the release: set status and sealed_at timestamp
  db.prepare(
    `UPDATE releases SET status = 'sealed', sealed_at = datetime('now'), sealed_by = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(user?.id || null, releaseId);

  // Best-effort git tag creation (non-blocking)
  const tagName = release.version || `release-${releaseId}`;
  try {
    execSync(`git tag -a "${tagName}" -m "Release sealed: ${release.version || tagName}"`, { timeout: 5000 });
  } catch (err) {
    console.warn(`[release-seal] Failed to create git tag "${tagName}":`, err);
  }

  const sealed = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);
  res.status(200).json(sealed);
});
