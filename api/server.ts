import express from 'express';
import { healthRouter } from './routes/health.js';
import { getDb, closeDb } from './db/connection.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());

// Initialize database before starting
const db = getDb();
console.log(`Database connected (WAL mode, migrations table ready)`);

app.use('/health', healthRouter);

const server = app.listen(PORT, () => {
  console.log(`Mindspace API server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

export { app };
