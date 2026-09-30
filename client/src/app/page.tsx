export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col
      items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        AI Codebase Assistant
      </h1>
      <p className="max-w-xl text-zinc-400">
        Ingest a GitHub repository or ZIP, then ask questions and get
        answers backed by cited file paths and line numbers.
      </p>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50
        px-4 py-3 text-sm text-zinc-400">
        Scaffold ready — chat UI arrives in Step 6.
      </div>
    </main>
  );
}
