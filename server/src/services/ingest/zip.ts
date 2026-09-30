import AdmZip from 'adm-zip';
import path from 'node:path';
import { env } from '../../config/env.js';
import { detectLanguage, RepoFile, isExcludedDir } from './filter.js';

const BINARY_HINT_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.woff', '.woff2', '.ttf', '.zip', '.gz', '.mp4', '.webm',
];

function looksBinary(buf: Buffer): boolean {
  // null byte in first 8000 bytes => treat as binary
  const slice = buf.subarray(0, Math.min(buf.length, 8000));
  return slice.includes(0);
}

/**
 * Extract supported code files from a ZIP buffer.
 * Handles nested folders and strips a single top-level folder
 * (the GitHub zipball convention: repo-main/...).
 */
export function extractCodeFiles(zipBuffer: Buffer): RepoFile[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const files: RepoFile[] = [];

  // detect single top-level folder prefix
  const topDirs = new Set<string>();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const parts = e.entryName.split('/');
    if (parts.length > 1) topDirs.add(parts[0]);
  }
  const stripPrefix = topDirs.size === 1 ? [...topDirs][0] + '/' : '';

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;

    if (name.startsWith('.') || name.includes('/.git/')) continue;

    const rel = stripPrefix && name.startsWith(stripPrefix)
      ? name.slice(stripPrefix.length)
      : name;
    if (!rel || rel.startsWith('.')) continue;
    if (isExcludedDir(rel)) continue;

    const ext = path.extname(rel).toLowerCase();
    if (BINARY_HINT_EXTENSIONS.includes(ext)) continue;

    const language = detectLanguage(rel);
    if (!language) continue;

    const size = entry.header.size;
    if (size > env.maxFileBytes) continue;

    const buf = entry.getData();
    if (looksBinary(buf)) continue;

    files.push({
      filePath: rel,
      content: buf.toString('utf8'),
      language,
      size: buf.length,
    });

    if (files.length >= env.maxFiles) break;
  }

  return files;
}
