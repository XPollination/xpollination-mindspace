import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(401).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as any;
    // Map sub to req.user.id, attach email and name
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
