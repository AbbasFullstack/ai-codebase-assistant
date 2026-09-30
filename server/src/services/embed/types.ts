import { RepoFile } from '../ingest/filter.js';

export interface CodeChunk {
  id: string;
  text: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  functionName?: string;
  className?: string;
}

export interface EmbeddedChunk {
  embedding: number[];
  metadata: Omit<CodeChunk, 'id' | 'text'> & { jobId: string; text?: string };
}

export interface EmbedJobStatus {
  jobId: string;
  status: 'queued' | 'chunking' | 'embedding' | 'done' | 'error';
  totalChunks?: number;
  embeddedChunks?: number;
  filesProcessed?: number;
  error?: string;
  finishedAt?: string;
}

export type { RepoFile };
