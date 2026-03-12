import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './api-key-auth.js';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as any;
    (req as any).user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    next();
  }
}

export function requireApiKeyOrJwt(req: Request, res: Response, next: NextFunction): void {
  apiKeyAuth(req, res, () => {
    if ((req as any).user) {
      next();
      return;
    }

    jwtAuth(req, res, () => {
      if ((req as any).user) {
        next();
        return;
      }

      res.status(401).json({ error: 'Authentication required' });
    });
  });
}
