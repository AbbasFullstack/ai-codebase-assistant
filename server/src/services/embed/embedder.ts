import { env } from '../../config/env.js';
import { CodeChunk, EmbeddedChunk } from './types.js';

const BATCH_SIZE = 100; // chunks per embeddings request
const MAX_RETRIES = 5;

// minimal interface both models satisfy
interface EmbedModel {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

let cached: EmbedModel | null = null;

export async function getEmbeddingsModel(): Promise<EmbedModel> {
  if (cached) return cached;

  if (env.embeddingProvider === 'openai') {
    const { OpenAIEmbeddings } = await import('@langchain/openai');
    cached = new OpenAIEmbeddings({
      apiKey: env.openaiKey,
      model: env.openaiEmbeddingModel,
      batchSize: BATCH_SIZE,
    }) as unknown as EmbedModel;
    return cached;
  }

  // Free local embeddings via Transformers.js — no API key.
  // First call downloads the ONNX model (~120MB) to the cache;
  // afterwards it runs fully offline.
  const { pipeline } = await import('@huggingface/transformers');
  console.log('[embed] loading local model: ' + env.hfEmbeddingModel);
  const extractor: any = await pipeline(
    'feature-extraction',
    env.hfEmbeddingModel,
  );
  cached = {
    embedDocuments: async (texts: string[]) => {
      const out = await extractor(texts, { pooling: 'mean', normalize: true });
      return out.tolist() as number[][];
    },
    embedQuery: async (text: string) => {
      const out = await extractor(text, { pooling: 'mean', normalize: true });
      return (out.tolist() as number[][])[0];
    },
  };
  return cached;
}
/** Vector dimension for the active embedding model (Pinecone). */
export function embeddingDimension(): number {
  if (env.embeddingProvider === 'openai') {
    return env.openaiEmbeddingModel.includes('large') ? 3072 : 1536;
  }
  return 384; // multilingual-e5-small
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embed chunks with batching + exponential-backoff retry.
 * E5 models expect "passage: " prefix for documents.
 */
export async function embedChunks(
  chunks: CodeChunk[],
  onProgress?: (embedded: number, total: number) => void,
): Promise<EmbeddedChunk[]> {
  if (!chunks.length) return [];
  const model = await getEmbeddingsModel();
  const out: EmbeddedChunk[] = [];

  const total = chunks.length;
  const prefix = env.embeddingProvider === 'openai' ? '' : 'passage: ';

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => prefix + c.text);

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
              ...(c.functionName
                ? { functionName: c.functionName }
                : {}),
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
