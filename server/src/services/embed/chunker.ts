import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { RepoFile } from '../ingest/filter.js';
import { CodeChunk } from './types.js';

// chunk size in chars ~ 4 chars/token; 3600 chars ~ 900 tokens
const CHUNK_SIZE = 3600;
// overlap ~ 600 chars ~ 150 tokens
const CHUNK_OVERLAP = 600;

// language-specific primary separators (code-aware splitting)
const LANG_SEPARATORS: Record<string, string[]> = {
  typescript: ['\nfunction ', '\nclass ', '\nexport function ',
    '\nconst ', '\nexport default ', '\n\n'],
  tsx: ['\nclass ', '\nfunction ', '\nconst ', '\nexport default ', '\n\n'],
  javascript: ['\nfunction ', '\nclass ', '\nexport function ',
    '\nconst ', '\nexport default ', '\n\n'],
  jsx: ['\nclass ', '\nfunction ', '\nconst ', '\nexport default ', '\n\n'],
  python: ['\ndef ', '\nclass ', '\n\n\n'],
  java: ['\n  public ', '\n  private ', '\n  protected ',
    '\nclass ', '\n\n'],
  go: ['\nfunc ', '\ntype ', '\n\n'],
  rust: ['\nfn ', '\nimpl ', '\nstruct ', '\nenum ', '\n\n'],
  markdown: ['\n## ', '\n### ', '\n\n\n', '\n\n'],
};

const FALLBACK_SEPARATORS = ['\n\n', '\n', ' ', ''];

/** Detect enclosing function/class names by scanning upward from a line. */
function detectNames(
  lines: string[],
  startIdx: number, // zero-based
): { functionName?: string; className?: string } {
  let functionName: string | undefined;
  let className: string | undefined;
  const fnPatterns: RegExp[] = [
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/,
    /^\s*def\s+([A-Za-z0-9_]+)/,
    /^\s*fn\s+([A-Za-z0-9_]+)/,
    /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/,
    /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:[A-Za-z0-9_<>,\[\]]+\s+)?([A-Za-z0-9_]+)\s*\(/,
  ];
  const classPatterns: RegExp[] = [
    /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_$]+)/,
    /^\s*class\s+([A-Za-z0-9_]+)/,
    /^\s*(?:pub\s+)?(?:struct|enum)\s+([A-Za-z0-9_]+)/,
    /^\s*type\s+([A-Za-z0-9_]+)\s*(?:struct|interface)?\s*\{?/,
  ];
  for (let i = Math.min(startIdx, lines.length - 1); i >= 0; i--) {
    const line = lines[i];
    if (!functionName) {
      for (const p of fnPatterns) {
        const m = line.match(p);
        if (m) { functionName = m[1]; break; }
      }
    }
    if (!className) {
      for (const p of classPatterns) {
        const m = line.match(p);
        if (m) { className = m[1]; break; }
      }
    }
    if (functionName && className) break;
  }
  return { functionName, className };
}

/** Approximate 1-based line range of a chunk inside the file. */
function lineRange(
  fullLines: string[],
  chunkText: string,
  searchFrom: number, // zero-based line index
): { startLine: number; endLine: number; nextSearch: number } {
  const chunkLines = chunkText.split('\n');
  const first = (chunkLines.find((l) => l.trim().length > 0) ?? '').trim();
  const count = chunkLines.length;
  let startIdx = searchFrom;
  if (first) {
    for (let i = searchFrom; i < fullLines.length; i++) {
      if (fullLines[i].trim() === first) {
        startIdx = i;
        break;
      }
    }
  }
  const endIdx = Math.min(startIdx + count - 1, fullLines.length - 1);
  return {
    startLine: startIdx + 1,
    endLine: endIdx + 1,
    nextSearch: Math.max(startIdx + 1, endIdx - 20),
  };
}

/**
 * Chunk a repo file into semantic code chunks with rich metadata.
 */
export async function chunkFile(file: RepoFile): Promise<CodeChunk[]> {
  const separators = LANG_SEPARATORS[file.language] ?? FALLBACK_SEPARATORS;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators,
    keepSeparator: true,
  });

  const docs = await splitter.createDocuments([file.content]);
  const fullLines = file.content.split('\n');
  const chunks: CodeChunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < docs.length; i++) {
    const text = docs[i].pageContent.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    const { startLine, endLine, nextSearch } = lineRange(
      fullLines, text, searchFrom,
    );
    searchFrom = nextSearch;
    const names = detectNames(fullLines, startLine - 1);
    chunks.push({
      id: `${file.filePath}#chunk${i}`,
      text,
      filePath: file.filePath,
      language: file.language,
      startLine,
      endLine,
      chunkIndex: i,
      ...(names.functionName ? { functionName: names.functionName } : {}),
      ...(names.className ? { className: names.className } : {}),
    });
  }
  return chunks;
}

export async function chunkFiles(files: RepoFile[]): Promise<CodeChunk[]> {
  const all: CodeChunk[] = [];
  for (const f of files) {
    try {
      all.push(...(await chunkFile(f)));
    } catch {
      // skip files that fail to chunk
    }
  }
  return all;
}
