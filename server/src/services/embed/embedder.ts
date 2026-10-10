import { env } from '../../config/env.js';
import { CodeChunk, EmbeddedChunk } from './types.js';

const API_BATCH = 16; // per HF Inference API request
const LOCAL_BATCH = 100; // chunks per local embeddings pass
const MAX_RETRIES = 5;

// minimal interface both models satisfy
interface EmbedModel {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

let cached: EmbedModel | null = null;

// --- Hugging Face Inference API (external, fits tiny hosts) ---
function hfApiModel(): EmbedModel {
  const url = 'https://api-inference.huggingface.co/models/'
    + env.hfEmbeddingModel;
  async function call(texts: string[]): Promise<number[][]> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.hfApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new Error('HF Inference API ' + res.status + ': ' + text);
    }
    return (await res.json()) as number[][];
  }
  return {
    embedDocuments: async (texts) => {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += API_BATCH) {
        out.push(...(await call(texts.slice(i, i + API_BATCH))));
      }
      return out;
    },
    embedQuery: async (text) => (await call([text]))[0],
  };
}

// --- Local Transformers.js (no key, heavier RAM) ---
async function localModel(): Promise<EmbedModel> {
  const { pipeline } = await import('@huggingface/transformers');
  console.log('[embed] loading local model: ' + env.hfEmbeddingModel);
  const extractor: any = await pipeline(
    'feature-extraction',
    env.hfEmbeddingModel,
  );
  return {
    embedDocuments: async (texts) => {
      const out = await extractor(texts, { pooling: 'mean', normalize: true });
      return out.tolist() as number[][];
    },
    embedQuery: async (text) => {
      const out = await extractor(text, { pooling: 'mean', normalize: true });
      return (out.tolist() as number[][])[0];
    },
  };
}

export async function getEmbeddingsModel(): Promise<EmbedModel> {
  if (cached) return cached;

  // OpenAI embeddings (optional, paid)
  if (env.embeddingProvider === 'openai' && env.openaiKey) {
    const { OpenAIEmbeddings } = await import('@langchain/openai');
    cached = new OpenAIEmbeddings({
      apiKey: env.openaiKey,
      model: env.openaiEmbeddingModel,
      batchSize: LOCAL_BATCH,
    }) as unknown as EmbedModel;
    return cached;
  }

  // Hugging Face Inference API — external, ideal for 512MB hosts.
  // Used when provider is 'huggingface-api', or any time the key is set.
  if (env.hfApiKey) {
    console.log('[embed] using HF Inference API: ' + env.hfEmbeddingModel);
    cached = hfApiModel();
    return cached;
  }

  // Local fallback (free, no key) — needs ~200MB+ free RAM.
  if (env.embeddingProvider !== 'hf-local') {
    throw new Error(
      'EMBEDDING_PROVIDER=' + env.embeddingProvider + ' requires ' +
      'HUGGINGFACE_API_KEY (or use hf-local).',
    );
  }
  cached = await localModel();
  return cached;
}

/** Vector dimension for the active embedding model (Pinecone). */
export function embeddingDimension(): number {
  if (env.embeddingProvider === 'openai') {
    return env.openaiEmbeddingModel.includes('large') ? 3072 : 1536;
  }
  return 384; // multilingual-e5-small (local or HF API)
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
  const BATCH_SIZE = env.hfApiKey ? API_BATCH : LOCAL_BATCH;

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
