import { Router } from 'express';
import ingestRouter from './ingest.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/ingest', ingestRouter);
// Step 4+: router.use('/query', queryRouter);

export default router;
