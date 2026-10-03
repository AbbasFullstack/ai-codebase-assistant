# AI Codebase Assistant 🤖

An AI-powered assistant that ingests any GitHub repository (or ZIP),
chunks the code semantically, embeds it into a vector database, and
answers your questions with **source-backed citations** (file path + line
numbers) using a RAG pipeline.

## ✨ Features

- **Repository ingestion** — GitHub URL or ZIP upload, 10+ languages,
  auto-excludes `node_modules`, `dist`, `build`, `.next`, binaries
- **Semantic chunking** — language-aware separators, function/class name
  detection, line-number tracking
- **Embeddings** — OpenAI `text-embedding-3-small/large`, batched (100),
  exponential-backoff retries
- **Vector store** — Pinecone (cosine), one namespace per job,
  auto-cleanup
- **RAG answers** — LangChain + OpenAI/Anthropic, answers cite files
- **Streaming chat** — SSE token streaming, markdown + syntax-highlighted
  code, citations with relevance scores
- **Job pipeline** — async ingestion → chunking → embedding → upsert
  with live progress bars

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript |
| AI | LangChain, OpenAI, Anthropic |
| Embeddings | OpenAI text-embedding-3-small |
| Vector DB | Pinecone (serverless, cosine) |
| Deploy | Vercel (client) + Render (server) |

## 🏗️ Architecture

```
┌──────────────┐     POST /api/ingest      ┌──────────────────┐
│   Next.js    │ ─────────────────────────▶ │    Express API    │
│   (Vercel)   │                            │     (Render)      │
│              │     POST /api/rag/query    │                  │
│  Chat UI     │ ─────────────────────────▶ │  ┌────────────┐  │
│  (streaming) │◀─────── SSE tokens ──────── │  │ Ingestion  │  │
└──────────────┘                            │  │  GitHub/ZIP │  │
                                            │  └─────┬──────┘  │
                                            │        ▼         │
                                            │  ┌────────────┐  │
                                            │  │  Chunker   │  │
                                            │  └─────┬──────┘  │
                                            │        ▼         │
                                            │  ┌────────────┐  │
                                            │  │ Embeddings │──┼──▶ OpenAI
                                            │  └─────┬──────┘  │
                                            │        ▼         │
                                            │  ┌────────────┐  │
                                            │  │  Pinecone  │  │
                                            │  └────────────┘  │
                                            │        ▼         │
                                            │  ┌────────────┐  │
                                            │  │  RAG + LLM │──┼──▶ OpenAI
                                            │  │ (citations) │  │    /Claude
                                            │  └────────────┘  │
                                            └──────────────────┘
```

## 📸 Screenshots

| Landing | Ingest | Progress | Chat + Streaming | Citations |
|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO |

> Add screenshots to `docs/screenshots/` after first live run:
>
> 1. `landing.png` — home page
> 2. `ingest.png` — GitHub URL input
> 3. `progress.png` — parsing + embedding progress bar
> 4. `chat.png` — streaming answer
> 5. `citations.png` — citations below answer

## 🚀 Local Development

```bash
git clone https://github.com/AbbasFullstack/ai-codebase-assistant
cd ai-codebase-assistant
npm install                # installs both workspaces
cp .env.example server/.env
# fill in your keys, then:
npm run dev                # client :3000 + server :4000
```

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Embeddings + answers (GPT) |
| `ANTHROPIC_API_KEY` | optional | If set, Claude answers instead of GPT |
| `PINECONE_API_KEY` | ✅ | Pinecone vector DB |
| `PINECONE_INDEX` | ✅ | Index name (default `codebase-assistant`) |
| `PINECONE_ENVIRONMENT` | ✅ | Serverless region (e.g. `us-east-1`) |
| `GITHUB_TOKEN` | optional | Higher GitHub API rate limits |
| `CORS_ORIGIN` | ✅ (prod) | Frontend origin, comma-separated |
| `MAX_FILE_BYTES` / `MAX_FILES` | optional | Ingestion caps |
| `NEXT_PUBLIC_API_URL` | ✅ (client) | Backend base URL |

## 📡 API Reference

### Ingestion

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/ingest/github` | `{ repoUrl }` | `202 { jobId }` |
| POST | `/api/ingest/zip` | multipart `zip` | `202 { jobId }` |
| GET | `/api/ingest/status/:jobId` | — | status + fileCount |

### Indexing

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/embed` | `{ jobId }` | `202 { status }` |
| GET | `/api/embed/status/:jobId` | — | progress |
| POST | `/api/vector/upsert` | `{ jobId }` | `{ upserted }` |
| DELETE | `/api/vector/namespace/:jobId` | — | cleanup |

### RAG

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/rag/query` | `{ jobId, query, history?, topK? }` | `{ answer, citations }` |
| POST | `/api/rag/query/stream` | same | SSE: token → citations → done |

### Other

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check (Render) |

## ☁️ Deployment

### Backend → Render

1. Push repo to GitHub, keep it public.
2. Render → **New → Web Service** → connect the repo.
3. Root dir: `server` · Build: `npm install && npm run build` ·
   Start: `npm start` · Health check: `/api/health`.
4. Add env vars (table above). Free tier: server sleeps after 15 min
   idle — first request after idle is slow, that is expected.

### Frontend → Vercel

1. Vercel → **New Project** → import the repo.
2. Root directory: `client` (or rely on `vercel.json`).
3. Add env var `NEXT_PUBLIC_API_URL = https://<your-render-app>.onrender.com`.
4. Deploy.

### Post-deploy checklist

- [ ] `GET https://<backend>/api/health` returns `{ status: "ok" }`
- [ ] Frontend ingest → chat flow works end to end
- [ ] Pinecone namespace created for the first job

## 🔗 Links

- **Live demo:** TODO (add Vercel URL)
- **GitHub:** https://github.com/AbbasFullstack/ai-codebase-assistant

## 📄 License

MIT © 2026 Abbas Hussain
