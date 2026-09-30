import path from 'node:path';

export interface RepoFile {
  filePath: string;
  content: string;
  language: string;
  size: number;
}

const CODE_EXTENSIONS: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'jsx',
  '.tsx': 'tsx',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.md': 'markdown',
};

const EXCLUDED_DIRS = [
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '.cache', 'vendor', '__pycache__', '.venv',
];

export const MAX_FILE_BYTES = 1_000_000; // 1MB per file

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS[ext] ?? null;
}

export function isExcludedDir(relPath: string): boolean {
  const parts = relPath.split(/[\\\\/]+/);
  return parts.some((p) => EXCLUDED_DIRS.includes(p));
}

export function isSupportedFile(
  filePath: string,
  sizeBytes: number,
): boolean {
  if (sizeBytes > MAX_FILE_BYTES) return false;
  if (isExcludedDir(filePath)) return false;
  return detectLanguage(filePath) !== null;
}
