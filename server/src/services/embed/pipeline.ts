import { getJob } from '../ingest/jobManager.js';
import { chunkFiles } from './chunker.js';
import { embedChunks } from './embedder.js';
import { EmbeddedChunk, EmbedJobStatus } from './types.js';

interface TrackedStatus extends EmbedJobStatus {
  embedded?: EmbeddedChunk[];
}

const embedStatuses = new Map<string, TrackedStatus>();

export function getEmbedStatus(jobId: string): EmbedJobStatus | undefined {
  const s = embedStatuses.get(jobId);
  if (!s) return undefined;
  const { embedded: _e, ...rest } = s;
  return rest;
}

export function getEmbeddedChunks(jobId: string): EmbeddedChunk[] {
  return embedStatuses.get(jobId)?.embedded ?? [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runEmbedPipeline(
  jobId: string,
): Promise<TrackedStatus> {
  let status = embedStatuses.get(jobId);
  if (!status) {
    status = {
      jobId,
      status: 'queued',
      embeddedChunks: 0,
      filesProcessed: 0,
    };
    embedStatuses.set(jobId, status);
  }

  // 1. wait for ingestion to finish if still running (max 60s)
  const ingest = getJob(jobId);
  let waited = 0;
  while (
    ingest &&
    ingest.status !== 'done' &&
    ingest.status !== 'error' &&
    waited < 60_000
  ) {
    await sleep(500);
    waited += 500;
  }
  if (ingest?.status === 'error') {
    status.status = 'error';
    status.error = 'Ingestion failed: ' + (ingest.error ?? 'unknown');
    status.finishedAt = new Date().toISOString();
    return status;
  }
  const files = ingest?.files ?? [];
  if (!files.length) {
    status.status = 'error';
    status.error = 'No parsed files found for this jobId';
    status.finishedAt = new Date().toISOString();
    return status;
  }

  // 2. chunk
  status.status = 'chunking';
  const chunks = await chunkFiles(files);
  status.totalChunks = chunks.length;
  status.status = 'embedding';

  // 3. embed (batched, progress tracked)
  const embedded = await embedChunks(chunks, (done) => {
    status!.embeddedChunks = done;
  });
  for (const e of embedded) e.metadata.jobId = jobId;

  status.filesProcessed = files.length;
  status.embeddedChunks = embedded.length;
  status.embedded = embedded;
  status.status = 'done';
  status.finishedAt = new Date().toISOString();
  return status;
}

export function startEmbedJob(jobId: string): TrackedStatus {
  const existing = embedStatuses.get(jobId);
  if (existing && existing.status !== 'done' && existing.status !== 'error') {
    return existing; // already running
  }
  const fresh: TrackedStatus = {
    jobId,
    status: 'queued',
    embeddedChunks: 0,
    filesProcessed: 0,
  };
  embedStatuses.set(jobId, fresh);
  runEmbedPipeline(jobId).catch((err) => {
    const s = embedStatuses.get(jobId);
    if (s) {
      s.status = 'error';
      s.error = err instanceof Error ? err.message : String(err);
      s.finishedAt = new Date().toISOString();
    }
  });
  return fresh;
}
