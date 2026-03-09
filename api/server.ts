import express from 'express';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Mindspace API server listening on port ${PORT}`);
});

export { app };
