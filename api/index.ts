import express from 'express';
import { apiRouter } from '../server/routes';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Mount Unified API Router for Production Serverless Execution
app.use('/api', apiRouter);

export default app;
