'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodePreview({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, fontSize: '12px' }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
