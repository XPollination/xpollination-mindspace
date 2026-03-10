import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { getConnectionCount } from '../lib/sse-manager.js';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  let dbStatus = 'ok';
  try {
    const db = getDb();
    // Quick integrity check — ensures DB is readable
    db.prepare('SELECT 1').get();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    version: '0.0.7',
    uptime: process.uptime(),
    database: dbStatus,
    sse_connections: getConnectionCount()
  });
});

export { healthRouter };
