import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Step 2+: router.use('/ingest', ingestRouter);
// Step 4+: router.use('/query', queryRouter);

export default router;
