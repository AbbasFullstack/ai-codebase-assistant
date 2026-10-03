import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col
      items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          AI <span className="text-orange-500">Codebase</span> Assistant
        </h1>
        <p className="mx-auto max-w-xl text-zinc-400">
          Ingest any GitHub repository or ZIP, then ask questions and
          get answers backed by cited file paths and line numbers.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/ingest"
          className="rounded-xl bg-orange-500 px-6 py-3 text-sm
          font-semibold text-zinc-950 transition hover:bg-orange-400">
          Ingest a Repository
        </Link>
        <Link href="/chat"
          className="rounded-xl border border-zinc-700 px-6 py-3 text-sm
          font-semibold text-zinc-200 transition hover:border-orange-500
            hover:text-orange-400">
          Open Chat
        </Link>
      </div>

      <div className="grid gap-3 text-left text-xs text-zinc-500
        sm:grid-cols-3">
        {[
          ['Ingest', 'GitHub URL ya ZIP upload — 10+ languages'],
          ['Index', 'Semantic chunks + embeddings + Pinecone'],
          ['Ask', 'RAG answers with file/line citations'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-zinc-800
            bg-zinc-900/50 p-4">
            <p className="mb-1 text-sm font-semibold text-orange-400">{t}</p>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
