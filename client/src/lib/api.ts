export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const BASE = API_URL + '/api';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function ingestGitHub(repoUrl: string) {
  return json<{ jobId: string; status: string }>(
    await fetch(BASE + '/ingest/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    }),
  );
}

export async function ingestZip(file: File) {
  const form = new FormData();
  form.append('zip', file);
  return json<{ jobId: string; status: string }>(
    await fetch(BASE + '/ingest/zip', { method: 'POST', body: form }),
  );
}

export async function getIngestStatus(jobId: string) {
  return json<import('./types.js').IngestStatus>(
    await fetch(BASE + '/ingest/status/' + encodeURIComponent(jobId)),
  );
}

export async function startEmbed(jobId: string) {
  return json<{ jobId: string; status: string }>(
    await fetch(BASE + '/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }),
  );
}

export async function getEmbedStatus(jobId: string) {
  return json<import('./types.js').EmbedStatus>(
    await fetch(BASE + '/embed/status/' + encodeURIComponent(jobId)),
  );
}

export async function upsertVectors(jobId: string) {
  return json<{ jobId: string; upserted: number }>(
    await fetch(BASE + '/vector/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }),
  );
}
