import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  startGitHubJob,
  startZipJob,
  getJob,
  publicJob,
} from '../services/ingest/jobManager.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB ZIP max upload
    files: 1,
  },
});

const githubSchema = z.object({
  repoUrl: z.string().url(),
});

// POST /api/ingest/github  { repoUrl }
router.post('/github', (req, res) => {
  const parsed = githubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'repoUrl is required (https://github.com/<owner>/<repo>)',
    });
  }
  const job = startGitHubJob(parsed.data.repoUrl);
  return res.status(202).json({ jobId: job.jobId, status: job.status });
});

// POST /api/ingest/zip  (multipart file field: "zip")
router.post('/zip', upload.single('zip'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ZIP file is required' });
  }
  const label = req.file.originalname || 'upload.zip';
  if (!/\.zip$/i.test(label)) {
    return res.status(400).json({ error: 'Only .zip files are accepted' });
  }
  const job = startZipJob(req.file.buffer, label);
  return res.status(202).json({ jobId: job.jobId, status: job.status });
});

// GET /api/ingest/status/:jobId
router.get('/status/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Unknown jobId' });
  }
  return res.json(publicJob(job));
});

export default router;
