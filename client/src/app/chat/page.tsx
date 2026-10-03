'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { ChatMessageData } from '@/lib/types';
import { API_URL } from '@/lib/api';
import { streamRagQuery } from '@/lib/stream';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import Toasts, { ToastData } from '@/components/Toast';

function ChatPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get('jobId') ?? '';

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [lastQuery, setLastQuery] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pushToast = useCallback(
    (kind: 'error' | 'success', message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        5000,
      );
    },
    [],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (queryText?: string) => {
    const q = (queryText ?? input).trim();
    if (!q || isLoading || !jobId) return;
    setLastQuery(q);
    setInput('');
    setIsLoading(true);

    const history = messages.slice(-5).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: ChatMessageData = { role: 'user', content: q };
    const placeholder: ChatMessageData = {
      role: 'assistant',
      content: '',
    };
    setMessages((m) => [...m, userMsg, placeholder]);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateLast = (fn: (msg: ChatMessageData) => ChatMessageData) => {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });
    };

    try {
      await streamRagQuery(
        API_URL,
        { jobId, query: q, history },
        {
          onToken: (token) =>
            updateLast((msg) => ({ ...msg, content: msg.content + token })),
          onCitations: (citations) =>
            updateLast((msg) => ({ ...msg, citations })),
          onError: (message) =>
            updateLast((msg) => ({
              ...msg,
              content: msg.content || message,
              error: true,
            })),
        },
        controller.signal,
      );
      updateLast((msg) =>
        msg.content
          ? msg
          : { ...msg, content: 'I don\'t have enough context to answer this.' },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'The user aborted a request.' && !/aborted/i.test(msg)) {
        pushToast('error', msg);
      }
      updateLast((m) => ({
        ...m,
        content: m.content || 'Request failed — tap Retry.',
        error: true,
      }));
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, jobId, messages, pushToast]);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    pushToast('success', 'Chat cleared');
  };

  const copyAnswer = async (index: number) => {
    const text = messages[index]?.content ?? '';
    try {
      await navigator.clipboard.writeText(text);
      pushToast('success', 'Answer copied');
    } catch {
      pushToast('error', 'Copy failed');
    }
  };

  const retryLast = () => {
    if (!lastQuery) return;
    setMessages((m) => m.slice(0, -2));
    setTimeout(() => send(lastQuery), 50);
  };

  if (!jobId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col
        items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-400">
          No repository ingested yet.
        </p>
        <Link href="/ingest"
          className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm
          font-semibold text-zinc-950 hover:bg-orange-400">
          Ingest a repository
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col px-4
      md:px-6">
      <Toasts toasts={toasts} onDismiss={(id) =>
        setToasts((t) => t.filter((x) => x.id !== id))} />

      <header className="flex items-center justify-between gap-2
        border-b border-zinc-800 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">Codebase Chat</h1>
          <p className="truncate text-xs text-zinc-500 font-mono">
            job: {jobId.slice(0, 8)}…
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/ingest" className="rounded-lg border
            border-zinc-700 px-3 py-1.5 text-xs text-zinc-300
            hover:border-orange-500 hover:text-orange-400">
            New repo
          </Link>
          <button onClick={clearChat} className="rounded-lg border
            border-zinc-700 px-3 py-1.5 text-xs text-zinc-300
            hover:border-red-500 hover:text-red-400">
            Clear
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center
            justify-center gap-2 text-zinc-500">
            <p className="text-sm">Ask anything about the codebase.</p>
            <p className="text-xs">e.g. "Where is auth handled?"</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <ChatMessage msg={m} />
            {m.role === 'assistant' && m.content && (
              <div className="flex gap-2 pl-2 text-[11px] text-zinc-500">
                <button onClick={() => copyAnswer(i)}
                  className="hover:text-orange-400">Copy</button>
                {m.error && lastQuery && !isLoading && (
                  <button onClick={retryLast}
                    className="hover:text-orange-400">Retry</button>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading &&
          messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-1.5 pl-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-pulse
                rounded-full bg-orange-500/70"
                style={{ animationDelay: i * 150 + 'ms' }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="pb-4">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => send()}
          isLoading={isLoading}
        />
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          Answers cite source files — verify before relying on them.
        </p>
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center
        justify-center text-zinc-500">Loading…</main>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
