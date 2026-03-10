import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  contributor: 1,
  admin: 2
};

/**
 * Factory middleware: requireProjectAccess(minRole)
 * Checks project_access table for current user + project from req.params.slug.
 * Returns 403 if insufficient role or no membership, 404 if project not found.
 * Attaches req.projectAccess for downstream use.
 */
export function requireProjectAccess(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Project slug is required' });
      return;
    }

    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(slug);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // System admin bypass — check users table
    const userRow = db.prepare('SELECT is_system_admin FROM users WHERE id = ?').get(user.id) as any;
    if (userRow?.is_system_admin === 1) {
      (req as any).projectAccess = {
        role: 'admin',
        level: ROLE_HIERARCHY['admin'],
        project_slug: slug,
        is_system_admin: true
      };
      next();
      return;
    }

    // Check project_access for membership
    const access = db.prepare(
      'SELECT role FROM project_access WHERE user_id = ? AND project_slug = ?'
    ).get(user.id, slug) as any;

    if (!access) {
      res.status(403).json({ error: 'Access denied: not a member of this project' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[access.role] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: `Insufficient role: requires ${minRole}, you have ${access.role}` });
      return;
    }

    // Attach access info for downstream handlers
    (req as any).projectAccess = {
      role: access.role,
      level: userLevel,
      project_slug: slug
    };

    next();
  };
}
