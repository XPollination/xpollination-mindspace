import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = (err as any).statusCode || 500;
  logger.error({ err, statusCode }, err.message);
  res.status(statusCode).json({ error: err.message });
}
