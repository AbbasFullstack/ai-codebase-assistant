import { Router } from 'express';
import { z } from 'zod';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
} from '../vector/pinecone.js';
import { getEmbeddedChunks } from '../services/embed/pipeline.js';
import { getEmbeddingsModel } from '../services/embed/embedder.js';
import { getJob } from '../services/ingest/jobManager.js';

const router = Router();

const upsertSchema = z.object({
  jobId: z.string().min(1),
});

// POST /api/vector/upsert  { jobId }
// Upserts the embedded chunks for a completed embed job into Pinecone.
router.post('/upsert', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'jobId is required' });
  }
  const { jobId } = parsed.data;
  const chunks = getEmbeddedChunks(jobId);
  if (!chunks.length) {
    return res.status(409).json({
      error: 'No embedded chunks for this jobId. Run POST /api/embed first.',
    });
  }
  try {
    const count = await upsertVectors(jobId, chunks);
    return res.json({ jobId, upserted: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

const querySchema = z.object({
  jobId: z.string().min(1),
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional(),
});

// POST /api/vector/query  { jobId, query, topK? }
// Embeds the query text and returns similar code chunks from the namespace.
router.post('/query', async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'jobId and query are required (topK optional 1-50)',
    });
  }
  const { jobId, query, topK } = parsed.data;
  try {
    const model = getEmbeddingsModel();
    const embedding = await model.embedQuery(query);
    const matches = await queryVectors(jobId, embedding, topK ?? 8);
    return res.json({ jobId, matches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// DELETE /api/vector/namespace/:jobId
router.delete('/namespace/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  if (!getJob(jobId)) {
    return res.status(404).json({ error: 'Unknown jobId' });
  }
  try {
    await deleteNamespace(jobId);
    return res.json({ jobId, deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
