import { Router } from 'express';
import { z } from 'zod';
import { startEmbedJob, getEmbedStatus } from '../services/embed/pipeline.js';
import { getJob } from '../services/ingest/jobManager.js';

const router = Router();

const embedSchema = z.object({ jobId: z.string().min(1) });

// POST /api/embed  { jobId }
router.post('/', (req, res) => {
  const parsed = embedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'jobId is required' });
  }
  const { jobId } = parsed.data;
  if (!getJob(jobId)) {
    return res.status(404).json({ error: 'Unknown jobId' });
  }
  const status = startEmbedJob(jobId);
  return res.status(202).json({ jobId, status: status.status });
});

// GET /api/embed/status/:jobId
router.get('/status/:jobId', (req, res) => {
  const status = getEmbedStatus(req.params.jobId);
  if (!status) {
    return res.status(404).json({ error: 'No embed job for this jobId' });
  }
  return res.json(status);
});

export default router;
