export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  score: number;
  functionName?: string;
  className?: string;
}

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  error?: boolean;
}

export interface IngestStatus {
  jobId: string;
  source: 'github' | 'zip';
  label: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  fileCount?: number;
  totalBytes?: number;
  languages?: Record<string, number>;
  error?: string;
}

export interface EmbedStatus {
  jobId: string;
  status: 'queued' | 'chunking' | 'embedding' | 'done' | 'error';
  totalChunks?: number;
  embeddedChunks?: number;
  filesProcessed?: number;
  error?: string;
}
