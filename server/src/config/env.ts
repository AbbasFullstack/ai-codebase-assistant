import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  pineconeKey: process.env.PINECONE_API_KEY ?? '',
  pineconeIndex: process.env.PINECONE_INDEX ?? 'codebase-chunks',
  githubToken: process.env.GITHUB_TOKEN ?? '',
  maxFileBytes: Number(process.env.MAX_FILE_BYTES ?? 512000),
  maxFiles: Number(process.env.MAX_FILES ?? 2000),
};

export function assertAIKeys() {
  if (!env.openaiKey && !env.anthropicKey) {
    throw new Error('Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env');
  }
}
