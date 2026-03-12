import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: { 'user-agent': req.headers['user-agent'] }
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${(res as any).statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${(res as any).statusCode}`
});
