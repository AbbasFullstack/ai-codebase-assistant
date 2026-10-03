import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config/env.js';
import { EmbeddedChunk } from '../services/embed/types.js';

const UPSERT_BATCH = 100;
const MAX_RETRIES = 5;

export interface VectorMatch {
  id: string;
  score: number;
  metadata: {
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    chunkIndex: number;
    functionName?: string;
    className?: string;
    jobId: string;
    content?: string;
  };
}

let client: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!env.pineconeKey) {
    throw new Error('PINECONE_API_KEY is not set');
  }
  if (!client) {
    client = new Pinecone({
      apiKey: env.pineconeKey,
    });
  }
  return client;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  let attempt = 0;
  for (;;) {
    try {
      await fn();
      return;
    } catch (err) {
      attempt++;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /429|rate|limit|timeout|ECONN|5\d\d/i.test(msg);
      if (attempt >= MAX_RETRIES || !retryable) {
        console.error('[vector] ' + label + ' failed: ' + msg);
        throw err;
      }
      const backoff = 1000 * 2 ** (attempt - 1) + Math.random() * 500;
      console.warn(
        '[vector] ' + label + ' retry ' + attempt + ' in ' +
          Math.round(backoff) + 'ms: ' + msg.slice(0, 120),
      );
      await sleep(backoff);
    }
  }
}

/**
 * Create the index if it does not exist (cosine metric).
 * Dimension is derived from the embedding model name.
 */
export async function ensureIndex(dimension: number): Promise<void> {
  const pc = getPinecone();
  const name = env.pineconeIndex;
  try {
    await pc.describeIndex(name);
    return; // exists
  } catch {
    // not found -> create
  }
  await pc.createIndex({
    name,
    dimension,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: env.pineconeEnvironment || 'us-east-1',
      },
    },
  });
  // wait until ready (max ~60s)
  for (let i = 0; i < 30; i++) {
    try {
      const desc = await pc.describeIndex(name);
      if (desc.status?.ready) return;
    } catch {
      // keep polling
    }
    await sleep(2000);
  }
  throw new Error('Pinecone index did not become ready in time');
}

export function embeddingDimension(): number {
  return env.embeddingModel.includes('large') ? 3072 : 1536;
}

/**
 * Upsert embedded chunks in batches of 100.
 * Namespace = jobId (one namespace per ingested repo/job).
 */
export async function upsertVectors(
  jobId: string,
  chunks: EmbeddedChunk[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const pc = getPinecone();
  await ensureIndex(embeddingDimension());
  const index = pc.index(env.pineconeIndex);

  const total = chunks.length;
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const batch = chunks.slice(i, i + UPSERT_BATCH);
    const vectors = batch.map((c, j) => ({
      id: jobId + '-' + c.metadata.filePath + '-' + c.metadata.chunkIndex
        + '-' + (i + j),
      values: c.embedding,
      metadata: {
        filePath: c.metadata.filePath,
        language: c.metadata.language,
        startLine: c.metadata.startLine,
        endLine: c.metadata.endLine,
        chunkIndex: c.metadata.chunkIndex,
        ...(c.metadata.functionName
          ? { functionName: c.metadata.functionName }
          : {}),
        ...(c.metadata.className ? { className: c.metadata.className } : {}),
        jobId,
        content: c.metadata.text ?? '',
      },
    }));

    await withRetry('upsert batch ' + Math.floor(i / UPSERT_BATCH), async () => {
      await index.namespace(jobId).upsert(vectors as any);
    });

    upserted += batch.length;
    console.log(
      '[vector] upserted ' + upserted + '/' + total + ' (ns ' + jobId + ')',
    );
    onProgress?.(upserted, total);
  }
  return upserted;
}

/**
 * Query similar chunks for an embedding vector within a job namespace.
 */
export async function queryVectors(
  jobId: string,
  embedding: number[],
  topK = 8,
  filter?: Record<string, unknown>,
): Promise<VectorMatch[]> {
  const pc = getPinecone();
  const index = pc.index(env.pineconeIndex);
  const ns = index.namespace(jobId);
  const result = await ns.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });
  return (result.matches ?? []).map((m: any) => ({
    id: String(m.id),
    score: m.score ?? 0,
    metadata: m.metadata as VectorMatch['metadata'],
  }));
}

/**
 * Delete an entire namespace (cleanup after a job).
 */
export async function deleteNamespace(jobId: string): Promise<void> {
  const pc = getPinecone();
  const index = pc.index(env.pineconeIndex);
  await index.namespace(jobId).deleteAll();
  console.log('[vector] deleted namespace ' + jobId);
}
