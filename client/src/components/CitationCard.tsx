'use client';

import { Citation } from '@/lib/types';

export default function CitationCard({ c }: { c: Citation }) {
  const pct = Math.round(Math.max(0, Math.min(1, c.score)) * 100);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60
      px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-orange-400 truncate">
          {c.filePath}
        </span>
        <span className="shrink-0 rounded bg-orange-500/10 px-1.5
          py-0.5 font-mono text-[10px] text-orange-300">
          {pct}%
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2
        gap-y-0.5 text-zinc-400">
        <span>lines {c.startLine}–{c.endLine}</span>
        <span className="text-zinc-600">·</span>
        <span className="uppercase">{c.language}</span>
        {c.functionName && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="font-mono">fn {c.functionName}</span>
          </>
        )}
        {c.className && !c.functionName && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="font-mono">class {c.className}</span>
          </>
        )}
      </div>
    </div>
  );
}
