import express from 'express';
import { healthRouter } from './routes/health.js';
import { a2aConnectRouter } from './routes/a2a-connect.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());
app.use('/health', healthRouter);
app.use('/a2a/connect', a2aConnectRouter);

app.listen(PORT, () => {
  console.log(`Mindspace API server listening on port ${PORT}`);
});

export { app };
