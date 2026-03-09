import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.0.7',
    uptime: process.uptime()
  });
});

export { healthRouter };
