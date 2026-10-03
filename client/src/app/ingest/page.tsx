'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ingestGitHub,
  ingestZip,
  getIngestStatus,
  startEmbed,
  getEmbedStatus,
  upsertVectors,
} from '@/lib/api';
import Toasts, { ToastData } from '@/components/Toast';

type Phase = 'idle' | 'ingesting' | 'embedding' | 'upserting' | 'ready';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-orange-500
          transition-all duration-500"
          style={{ width: Math.min(100, pct) + '%' }} />
      </div>
    </div>
  );
}

export default function IngestPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [repoUrl, setRepoUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const pushToast = useCallback(
    (kind: 'error' | 'success', message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    },
  );

  const finishPipeline = useCallback(async (jobId: string) => {
    // 2. embed
    setPhase('embedding');
    setProgress(10);
    setStatusText('Chunking and embedding…');
    await startEmbed(jobId).catch((e: Error) =>
      pushToast('error', 'Embed failed: ' + e.message));

    for (;;) {
      await sleep(1500);
      const st = await getEmbedStatus(jobId);
      if (st.status === 'error') {
        pushToast('error', 'Embedding: ' + (st.error ?? 'failed'));
        setPhase('idle');
        return;
      }
      const total = st.totalChunks ?? 0;
      const done = st.embeddedChunks ?? 0;
      if (total > 0) setProgress(10 + (done / total) * 80);
      setStatusText('Embedded ' + done + '/' + (total || '?') + ' chunks');
      if (st.status === 'done') break;
    }

    // 3. upsert to pinecone
    setPhase('upserting');
    setProgress(95);
    setStatusText('Storing vectors…');
    try {
      await upsertVectors(jobId);
    } catch (e) {
      pushToast('error', 'Vector store: ' + (e as Error).message);
      setPhase('idle');
      return;
    }

    setProgress(100);
    setStatusText('Ready! Redirecting to chat…');
    setPhase('ready');
    await sleep(800);
    router.push('/chat?jobId=' + encodeURIComponent(jobId));
  }, [pushToast, router]);

  const handleIngest = async () => {
    if (phase !== 'idle') return;
    try {
      let jobId: string;
      setPhase('ingesting');
      setProgress(5);
      setStatusText('Fetching repository…');

      if (file) {
        const res = await ingestZip(file);
        jobId = res.jobId;
      } else if (repoUrl.trim()) {
        const res = await ingestGitHub(repoUrl.trim());
        jobId = res.jobId;
      } else {
        pushToast('error', 'Enter a GitHub URL or choose a ZIP file');
        setPhase('idle');
        return;
      }

      // poll ingestion status
      for (;;) {
        await sleep(1500);
        const st = await getIngestStatus(jobId);
        if (st.status === 'error') {
          pushToast('error', 'Ingestion: ' + (st.error ?? 'failed'));
          setPhase('idle');
          return;
        }
        if (st.status === 'done') {
          setStatusText(`Parsed ${st.fileCount ?? 0} files`);
          setProgress(10);
          break;
        }
        setStatusText('Ingesting: ' + st.status);
      }

      await finishPipeline(jobId);
    } catch (e) {
      pushToast('error', (e as Error).message);
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col
      justify-center gap-6 px-4 py-10">
      <Toasts toasts={toasts} onDismiss={(id) =>
        setToasts((t) => t.filter((x) => x.id !== id))} />

      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Ingest a Repository</h1>
        <p className="text-sm text-zinc-400">
          GitHub repo ya ZIP — code chunks ban ke vector store
          mein index ho jayega.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-800
        bg-zinc-900/50 p-5">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider
            text-zinc-500">
            GitHub URL
          </label>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            disabled={busy || Boolean(file)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900
              px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600
              focus:border-orange-500 focus:outline-none
              disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <div className="h-px flex-1 bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider
            text-zinc-500">
            Upload ZIP
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            disabled={busy || Boolean(repoUrl.trim())}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-dashed
              border-zinc-700 bg-zinc-900 px-3 py-6 text-sm
              text-zinc-400 file:mr-3 file:rounded-lg
              file:border-0 file:bg-orange-500 file:px-3
              file:py-1.5 file:text-zinc-950
              focus:border-orange-500 focus:outline-none
              disabled:opacity-50"
          />
          {file && (
            <p className="text-xs text-zinc-500 font-mono">{file.name}</p>
          )}
        </div>

        {busy && (
          <ProgressBar pct={progress} label={statusText} />
        )}

        <button
          onClick={handleIngest}
          disabled={busy}
          className="w-full rounded-xl bg-orange-500 py-2.5 text-sm
            font-semibold text-zinc-950 transition hover:bg-orange-400
            disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Ingest Repository'}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600">
        Large repos may take a few minutes to embed.
      </p>
    </main>
  );
}
