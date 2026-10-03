'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessageData } from '@/lib/types';
import CitationCard from './CitationCard';

function MessageBody({ msg }: { msg: ChatMessageData }) {
  if (msg.role === 'user') {
    return <p className="whitespace-pre-wrap">{msg.content}</p>;
  }
  return (
    <div className="prose-invert text-sm leading-relaxed break-words">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const text = String(children);
            const isBlock = text.includes('\n') || Boolean(match);
            if (!isBlock) {
              return (
                <code className="rounded bg-zinc-800 px-1 py-0.5
                  font-mono text-[12px] text-orange-300"
                  {...props}>
                  {children}
                </code>
              );
            }
            return (
              <SyntaxHighlighter
                language={match?.[1] ?? 'text'}
                style={oneDark}
                customStyle={{
                  fontSize: '12px',
                  borderRadius: '8px',
                  margin: '8px 0',
                }}
              >
                {text.replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
        }}
      >
        {msg.content}
      </ReactMarkdown>
    </div>
  );
}

function ChatMessageInner({ msg }: { msg: ChatMessageData }) {
  const isUser = msg.role === 'user';
  return (
    <div className={
      'flex w-full ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div className={
        'max-w-[88%] rounded-2xl px-4 py-3 md:max-w-[75%] ' +
        (isUser
          ? 'bg-orange-500 text-zinc-950'
          : 'bg-zinc-900 border border-zinc-800 text-zinc-100') +
        (msg.error ? ' border-red-500/50' : '')}>
        <MessageBody msg={msg} />
        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider
              text-zinc-500">
              Sources
            </p>
            {msg.citations.map((c, i) => (
              <CitationCard key={i} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessageInner);
