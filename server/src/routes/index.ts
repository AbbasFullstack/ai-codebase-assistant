import { Router } from 'express';
import ingestRouter from './ingest.js';
import embedRouter from './embed.js';
import vectorRouter from './vector.js';
import ragRouter from './rag.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/ingest', ingestRouter);
router.use('/embed', embedRouter);
router.use('/vector', vectorRouter);
router.use('/rag', ragRouter);

export default router;
