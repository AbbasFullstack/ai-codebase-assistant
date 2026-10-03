import { Router } from 'express';
import { z } from 'zod';
import { generateAnswer, ChatMessage } from '../rag/rag.js';

const router = Router();

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const querySchema = z.object({
  jobId: z.string().min(1),
  query: z.string().min(1).max(2000),
  history: z.array(messageSchema).max(20).optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

// POST /api/rag/query  { jobId, query, history?, topK? }
router.post('/query', async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'jobId and query are required (history optional)',
    });
  }
  const { jobId, query, history, topK } = parsed.data;
  try {
    const result = await generateAnswer(
      jobId,
      query,
      (history ?? []) as ChatMessage[],
      topK ?? 5,
    );
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// POST /api/rag/query/stream  (SSE streaming)
router.post('/query/stream', async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { jobId, query, history, topK } = parsed.data;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await generateAnswer(
      jobId,
      query,
      (history ?? []) as ChatMessage[],
      topK ?? 5,
      (token) => send('token', { token }),
    );
    send('citations', result.citations);
    send('done', { retrievedCount: result.retrievedCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send('error', { error: msg });
  } finally {
    res.end();
  }
});

export default router;
