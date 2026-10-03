'use client';

import { KeyboardEvent } from 'react';

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSend();
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border
      border-zinc-800 bg-zinc-900/80 p-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={
          disabled ? 'Ingest a repository first'
            : 'Ask about the codebase… (Enter to send)'
        }
        disabled={disabled}
        className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent
          px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500
          focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={onSend}
        disabled={isLoading || disabled || !value.trim()}
        className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-sm
          font-semibold text-zinc-950 transition
          hover:bg-orange-400
          disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? '…' : 'Send'}
      </button>
    </div>
  );
}
