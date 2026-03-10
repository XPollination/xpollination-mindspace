import express from 'express';
import { healthRouter } from './routes/health.js';
import { a2aStreamRouter } from './routes/a2a-stream.js';
import { agentCardRouter } from './routes/agent-card.js';
import { twinSchemaRouter } from './routes/twin-schema.js';
import { authRouter } from './routes/auth.js';
import { keysRouter } from './routes/keys.js';
import { oauthRouter } from './routes/oauth.js';
import { projectsRouter } from './routes/projects.js';
import { getDb, closeDb } from './db/connection.js';
import { requestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './lib/logger.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());
app.use(requestLogger);

// Initialize database before starting
const db = getDb();
logger.info('Database connected (WAL mode, migrations table ready)');

app.use('/health', healthRouter);
app.use('/a2a/stream', a2aStreamRouter);
app.use('/.well-known/agent.json', agentCardRouter);
app.use('/schemas/digital-twin-v1.json', twinSchemaRouter);
app.use('/api/auth', authRouter);
app.use('/api/keys', keysRouter);
app.use('/api/auth/oauth', oauthRouter);
app.use('/api/projects', projectsRouter);

// Error handling (after routes)
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Mindspace API server listening');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

export { app };
