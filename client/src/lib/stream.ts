import { Citation } from './types.js';

export interface RagStreamHandlers {
  onToken: (token: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone?: (info: { retrievedCount: number }) => void;
  onError?: (message: string) => void;
}

export async function streamRagQuery(
  apiUrl: string,
  body: { jobId: string; query: string; history?: unknown[]; topK?: number },
  handlers: RagStreamHandlers,
  signal?: AbortSignal,
) {
  const res = await fetch(apiUrl + '/api/rag/query/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string }).error || 'Request failed',
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
      }
      if (!dataLines.length) continue;
      let data: unknown;
      try { data = JSON.parse(dataLines.join('\n')); }
      catch { continue; }
      if (event === 'token') {
        handlers.onToken((data as { token: string }).token);
      } else if (event === 'citations') {
        handlers.onCitations(data as Citation[]);
      } else if (event === 'done') {
        handlers.onDone?.(data as { retrievedCount: number });
      } else if (event === 'error') {
        handlers.onError?.((data as { error: string }).error);
      }
    }
  }
}
