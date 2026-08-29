import express from 'express';
import { apiRouter } from '../server/routes';
import { personalAccountRouter } from '../server/personalAccountRoutes';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);
app.use('/api', personalAccountRouter);

export default app;
