import { queryVectors } from '../vector/pinecone.js';
import { getEmbeddingsModel } from '../services/embed/embedder.js';
import { env } from '../config/env.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  score: number;
  functionName?: string;
  className?: string;
}

export interface RagResult {
  answer: string;
  citations: Citation[];
  retrievedCount: number;
}

const PROMPT_HEADER =
  'You are a codebase assistant. Answer the user\'s question ' +
  'based ONLY on the provided code context.';

const INSTRUCTIONS = [
  'Instructions:',
  '- Answer only from the provided context',
  '- Cite file paths and line numbers',
  '- If the answer is not in the context, say "I don\'t have enough ' +
  'context to answer this."',
  '- Be concise and technical',
].join('\n');

/**
 * Retrieve top-K relevant chunks from Pinecone for a query.
 */
export async function retrieveContext(
  jobId: string,
  query: string,
  topK = 5,
) {
  const model = getEmbeddingsModel();
  const embedding = await model.embedQuery(query);
  return queryVectors(jobId, embedding, topK);
}

function formatHistory(history: ChatMessage[]): string {
  const recent = history.slice(-5);
  if (!recent.length) return '(none)';
  return recent
    .map((m) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content)
    .join('\n');
}

function buildContext(matches: {
  score: number;
  metadata: {
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    content?: string;
    functionName?: string;
    className?: string;
  };
}[]): string {
  return matches
    .map((m, i) => {
      const md = m.metadata;
      const name = md.functionName || md.className
        ? ' (' + (md.functionName ?? md.className) + ')'
        : '';
      return [
        `--- Chunk ${i + 1}: ${md.filePath}${name} ---`,
        `File: ${md.filePath} (lines ${md.startLine}-${md.endLine}, ` +
          `${md.language})`,
        md.content ?? '',
      ].join('\n');
    })
    .join('\n\n');
}

function llmMessages(
  context: string,
  question: string,
  history: ChatMessage[],
) {
  const system = [
    PROMPT_HEADER,
    '',
    'Code Context:',
    context,
    '',
    INSTRUCTIONS,
  ].join('\n');

  const msgs: { role: string; content: string }[] = [
    { role: 'system', content: system },
  ];

  for (const m of history.slice(-5)) {
    msgs.push({ role: m.role, content: m.content });
  }

  msgs.push({ role: 'user', content: 'User Question: ' + question });
  return msgs;
}

interface ChatCallOptions {
  context: string;
  question: string;
  history: ChatMessage[];
  onToken?: (token: string) => void;
}

async function callLLM(opts: ChatCallOptions): Promise<string> {
  const messages = llmMessages(opts.context, opts.question, opts.history);

  // Anthropic preferred if key present, else OpenAI
  if (env.anthropicKey) {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const llm = new ChatAnthropic({
      apiKey: env.anthropicKey,
      model: 'claude-sonnet-4-5',
      maxTokens: 2048,
      streaming: Boolean(opts.onToken),
    });
    if (opts.onToken) {
      let full = '';
      const stream = await llm.stream(messages as any);
      for await (const chunk of stream) {
        const token = String(chunk.content ?? '');
        if (token) { full += token; opts.onToken(token); }
      }
      return full;
    }
    const res = await llm.invoke(messages as any);
    return String(res.content);
  }

  const { ChatOpenAI } = await import('@langchain/openai');
  const llm = new ChatOpenAI({
    apiKey: env.openaiKey,
    model: 'gpt-4o-mini',
    streaming: Boolean(opts.onToken),
  });
  if (opts.onToken) {
    let full = '';
    const stream = await llm.stream(messages as any);
    for await (const chunk of stream) {
      const token = chunk.content ?? '';
      if (token) { full += String(token); opts.onToken(String(token)); }
    }
    return full;
  }
  const res = await llm.invoke(messages as any);
  return String(res.content);
}

/**
 * Full RAG pipeline: embed query -> retrieve chunks -> build prompt
 * -> call LLM -> return answer with citations.
 */
export async function generateAnswer(
  jobId: string,
  query: string,
  history: ChatMessage[] = [],
  topK = 5,
  onToken?: (token: string) => void,
): Promise<RagResult> {
  const matches = await retrieveContext(jobId, query, topK);
  if (!matches.length) {
    return {
      answer: 'I don\'t have enough context to answer this.',
      citations: [],
      retrievedCount: 0,
    };
  }

  const context = buildContext(matches);
  const answer = await callLLM({
    context,
    question: query,
    history,
    onToken,
  });

  const citations: Citation[] = matches.map((m) => ({
    filePath: m.metadata.filePath,
    startLine: m.metadata.startLine,
    endLine: m.metadata.endLine,
    language: m.metadata.language,
    score: m.score,
    ...(m.metadata.functionName
      ? { functionName: m.metadata.functionName }
      : {}),
    ...(m.metadata.className ? { className: m.metadata.className } : {}),
  }));

  return { answer, citations, retrievedCount: matches.length };
}
