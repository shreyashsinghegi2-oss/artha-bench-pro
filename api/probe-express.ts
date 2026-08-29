import express from 'express';

const app = express();
app.get('*', (_req, res) => res.status(200).json({ ok: true, layer: 'express-only', runtime: process.version }));
export default app;
