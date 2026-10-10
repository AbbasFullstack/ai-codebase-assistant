import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  // LLM keys — sab optional. Fallback chain:
  // Anthropic -> OpenAI -> Groq -> Ollama (free local)
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
  groqKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  // Embeddings: hf-local (free, no key) | openai
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'hf-local',
  openaiEmbeddingModel: process.env.EMBEDDING_MODEL
    ?? 'text-embedding-3-small',
  hfEmbeddingModel: process.env.HF_EMBEDDING_MODEL
    ?? 'Xenova/multilingual-e5-small',
  hfApiKey: process.env.HUGGINGFACE_API_KEY ?? '',
  hfApiModel: process.env.HF_API_MODEL ?? '',
  // Pinecone free tier
  pineconeKey: process.env.PINECONE_API_KEY ?? '',
  pineconeIndex: process.env.PINECONE_INDEX ?? 'codebase-assistant',
  pineconeEnvironment: process.env.PINECONE_ENVIRONMENT ?? '',
  // GitHub ingestion
  githubToken: process.env.GITHUB_TOKEN ?? '',
  maxFileBytes: Number(process.env.MAX_FILE_BYTES ?? 512000),
  maxFiles: Number(process.env.MAX_FILES ?? 2000),
  // Ollama (free local LLM fallback)
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2',
} as const;
