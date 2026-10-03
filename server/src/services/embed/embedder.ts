import { OpenAIEmbeddings } from '@langchain/openai';
import { env } from '../../config/env.js';
import { CodeChunk, EmbeddedChunk } from './types.js';

const BATCH_SIZE = 100; // chunks per embeddings request
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getEmbeddingsModel() {
  return new OpenAIEmbeddings({
    apiKey: env.openaiKey,
    model: env.embeddingModel,
    batchSize: BATCH_SIZE,
    // retries handled manually in embedChunks below
  });
}

/**
 * Embed chunks with batching + exponential-backoff retry.
 * Rate-limit (429) and transient (5xx/timeout) errors are retried.
 */
export async function embedChunks(
  chunks: CodeChunk[],
  onProgress?: (embedded: number, total: number) => void,
): Promise<EmbeddedChunk[]> {
  if (!chunks.length) return [];
  const model = getEmbeddingsModel();
  const out: EmbeddedChunk[] = [];
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    let attempt = 0;
    for (;;) {
      try {
        const vectors = await model.embedDocuments(texts);
        for (let j = 0; j < batch.length; j++) {
          const c = batch[j];
          out.push({
            embedding: vectors[j],
            metadata: {
              jobId: '', // filled by pipeline
              filePath: c.filePath,
              language: c.language,
              startLine: c.startLine,
              endLine: c.endLine,
              chunkIndex: c.chunkIndex,
              ...(c.functionName ? { functionName: c.functionName } : {}),
              ...(c.className ? { className: c.className } : {}),
              text: c.text,
            },
          });
        }
        break;
      } catch (err) {
        attempt++;
        const msg = err instanceof Error ? err.message : String(err);
        const retryable = /429|rate|limit|timeout|ECONN|5\d\d/i.test(msg);
        if (attempt >= MAX_RETRIES || !retryable) throw err;
        await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 500);
      }
    }
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return out;
}
