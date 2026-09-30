import { randomUUID } from 'node:crypto';
import { RepoFile } from './filter.js';
import { RepoMeta, ingestGitHubRepo } from './github.js';
import { extractCodeFiles } from './zip.js';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface IngestJob {
  jobId: string;
  source: 'github' | 'zip';
  label: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  meta?: RepoMeta;
  fileCount?: number;
  totalBytes?: number;
  languages?: Record<string, number>;
  /** Step 3+ consumers: chunker and embedder read files from here. */
  files?: RepoFile[];
}

const jobs = new Map<string, IngestJob>();
const MAX_COMPLETED_JOBS = 50;

function getOrCreate(
  source: 'github' | 'zip',
  label: string,
): IngestJob {
  const job: IngestJob = {
    jobId: randomUUID(),
    source,
    label,
    status: 'queued',
    startedAt: new Date().toISOString(),
  };
  jobs.set(job.jobId, job);
  pruneOld();
  return job;
}

function pruneOld() {
  const done = [...jobs.values()]
    .filter((j) => j.status === 'done' || j.status === 'error');
  if (done.length > MAX_COMPLETED_JOBS) {
    done.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const j of done.slice(0, done.length - MAX_COMPLETED_JOBS)) {
      jobs.delete(j.jobId);
    }
  }
}

function finalize(job: IngestJob, files: RepoFile[], meta?: RepoMeta) {
  job.meta = meta;
  job.fileCount = files.length;
  job.totalBytes = files.reduce((s, f) => s + f.size, 0);
  const langs: Record<string, number> = {};
  for (const f of files) langs[f.language] = (langs[f.language] ?? 0) + 1;
  job.languages = langs;
  job.files = files;
  job.status = 'done';
  job.finishedAt = new Date().toISOString();
}

export function startGitHubJob(repoUrl: string): IngestJob {
  const job = getOrCreate('github', repoUrl);
  queueMicrotask(async () => {
    job.status = 'processing';
    try {
      const { meta, files } = await ingestGitHubRepo(repoUrl);
      finalize(job, files, meta);
    } catch (err) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    }
  });
  return job;
}

export function startZipJob(
  zipBuffer: Buffer,
  label: string,
): IngestJob {
  const job = getOrCreate('zip', label);
  queueMicrotask(async () => {
    job.status = 'processing';
    try {
      const files = extractCodeFiles(zipBuffer);
      finalize(job, files);
    } catch (err) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    }
  });
  return job;
}

export function getJob(jobId: string): IngestJob | undefined {
  return jobs.get(jobId);
}

export function publicJob(job: IngestJob) {
  const { files: _files, ...rest } = job;
  return rest;
}
