# AI Codebase Assistant

An AI-powered assistant that ingests any GitHub repository (or ZIP),
chunks the code semantically, embeds it into a vector database, and
answers your questions with **source-backed citations** (file path + line
numbers) using a RAG pipeline.

Built on a **fully free stack**: local Hugging Face embeddings, Pinecone
free tier, and a Groq / Ollama LLM fallback chain. No OpenAI key required.

## Features

- Repository ingestion (GitHub URL + ZIP upload)
- Semantic code chunking with file/line/function metadata
- Vector search via Pinecone (free tier, 384-dim e5 embeddings)
- RAG pipeline with citations (filePath, startLine, endLine)
- Streaming chat UI (SSE) with Next.js + Tailwind
- LLM fallback chain: Anthropic -> OpenAI -> Groq -> Ollama

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| AI orchestration | LangChain |
| Embeddings | Xenova/multilingual-e5-small via Transformers.js (local, free) |
| Vector DB | Pinecone free tier (cosine, 384 dims) |
| LLM | Anthropic / OpenAI / Groq (free tier) / Ollama (local) |

## Architecture (Free Stack)

`
                        +-------------------+
  GitHub URL / ZIP ---> |  Ingestion API    |
                        |  (Express)        |
                        +---------+---------+
                                  |
                                  v
                     +-----------------------+
                     | Chunker (LangChain   |
                     | RecursiveSplitter)   |
                     +----------+------------+
                                |
                                v
                +-------------------------------+
                | Local HF embeddings           |
                | (Xenova/multilingual-e5-     |
                |  small, 384 dims, no API key) |
                +---------------+---------------+
                                |
                                v
                     +---------------------+
                     | Pinecone (free tier |
                     | index, metadata:    |
                     | path, lines, lang)  |
                     +----------+----------+
                                |
          Chat query ---------> +
                                |
                                v
                +-------------------------------+
                | LLM fallback chain            |
                | Anthropic -> OpenAI -> Groq   |
                | -> Ollama (local)             |
                +---------------+---------------+
                                |
                                v
                     answer + citations (SSE)
`

## Quick Start (Local Development)

`bash
# 1. Clone and install
git clone https://github.com/AbbasFullstack/ai-codebase-assistant.git
cd ai-codebase-assistant
cd server && npm install && cp .env.example .env
cd ../client && npm install && cp .env.example .env

# 2. Run the backend (http://localhost:4000)
cd ../server && npm run dev

# 3. Run the frontend (http://localhost:3000)
cd client && npm run dev
`

## Free Stack Setup

### 1. Embeddings (free, local)

No OpenAI key needed. Embeddings run locally with Transformers.js using
Xenova/multilingual-e5-small (384 dimensions). Set:

`bash
EMBEDDING_PROVIDER=hf-local
HF_EMBEDDING_MODEL=Xenova/multilingual-e5-small
`

The Pinecone index is auto-created (384 dims, cosine) on first run.

### 2. Pinecone (free tier, no credit card)

1. Sign up at https://www.pinecone.io (free Starter plan).
2. Create an API key in the console.
3. The app auto-creates and connects to the index:

`bash
PINECONE_API_KEY=pcsk-...
PINECONE_INDEX=codebase-assistant
PINECONE_ENVIRONMENT=us-east-1
`

### 3. LLM (fallback chain: Anthropic -> OpenAI -> Groq -> Ollama)

All keys are optional. The first configured provider is used:

- ANTHROPIC_API_KEY -> Claude Sonnet
- OPENAI_API_KEY -> gpt-4o-mini
- GROQ_API_KEY -> llama-3.3-70b-versatile (recommended free option)
- fallback -> local Ollama

#### Groq (free, no credit card)

`bash
# Get a key at https://console.groq.com/keys
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
`

#### Ollama (free, local only)

`bash
# Install Ollama (macOS / Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download from https://ollama.com/download

# Pull the model and run
ollama pull llama3.2
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
`

> Note: Ollama only works when the server runs on your own machine.
> On Render, use the Groq free tier instead (see below).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| PORT | no | Server port (default 4000) |
| CORS_ORIGIN | no | Allowed origins (comma separated) |
| EMBEDDING_PROVIDER | no | hf-local (default, free) or openai |
| HF_EMBEDDING_MODEL | no | Local HF embedding model |
| EMBEDDING_MODEL | no | OpenAI embedding model (if provider=openai) |
| PINECONE_API_KEY | yes | Pinecone API key |
| PINECONE_INDEX | no | Index name (default codebase-assistant) |
| PINECONE_ENVIRONMENT | no | e.g. us-east-1 |
| ANTHROPIC_API_KEY | no | Claude (top of LLM chain) |
| OPENAI_API_KEY | no | OpenAI LLM (2nd) |
| GROQ_API_KEY | no | Groq free tier (3rd, recommended free option) |
| GROQ_MODEL | no | Default llama-3.3-70b-versatile |
| OLLAMA_BASE_URL | no | Local Ollama (final fallback) |
| OLLAMA_MODEL | no | Default llama3.2 |
| GITHUB_TOKEN | no | Raises GitHub API rate limits |

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | /api/ingest/github | Ingest repo from GitHub URL |
| POST | /api/ingest/zip | Ingest uploaded ZIP |
| GET | /api/ingest/status/:jobId | Ingestion status |
| POST | /api/embed | Chunk + embed a job |
| GET | /api/embed/status/:jobId | Embedding progress |
| POST | /api/vector/upsert | Upsert vectors |
| POST | /api/vector/query | Query vectors |
| DELETE | /api/vector/namespace/:jobId | Delete namespace |
| POST | /api/rag/query | RAG answer + citations |
| GET | /api/rag/query/stream | RAG answer via SSE |
| GET | /api/health | Health check |

## Deployment

### Backend (Render)

The repo includes render.yaml (Node web service, free plan).

> Important: the Render free plan has only 512 MB RAM. The local e5
> embedding model fits, but running Ollama alongside will not. On Render,
> set GROQ_API_KEY and use the Groq free tier for the LLM. Keep Ollama
> for local testing only.

### Frontend (Vercel)

- Framework: Next.js (client folder)
- Env var: NEXT_PUBLIC_API_URL pointing to your Render backend URL

## Screenshots

| Page | Screenshot |
| --- | --- |
| Landing | docs/screenshots/landing.png |
| Ingest | docs/screenshots/ingest.png |
| Chat + streaming | docs/screenshots/chat.png |
| Citations | docs/screenshots/citations.png |

## License

MIT
