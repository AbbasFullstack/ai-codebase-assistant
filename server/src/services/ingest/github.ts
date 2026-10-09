import { env } from '../../config/env.js';
import { RepoFile } from './filter.js';
import { extractCodeFiles } from './zip.js';

export interface RepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string | null;
  stars: number;
  htmlUrl: string;
}

const GH_API = 'https://api.github.com';

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ai-codebase-assistant',
  };
  if (env.githubToken) h.Authorization = `Bearer ${env.githubToken}`;
  return h;
}

export function parseRepoUrl(
  repoUrl: string,
): { owner: string; repo: string } {
  let u: URL;
  try {
    u = new URL(repoUrl);
  } catch {
    throw new Error('Invalid GitHub URL');
  }
  if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') {
    throw new Error('URL must be a github.com repository');
  }
  const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('URL must be https://github.com/<owner>/<repo>');
  }
  return { owner: parts[0], repo: parts[1] };
}

async function ghFetch(url: string): Promise<Response> {
  console.log(`[github] GET ${url}`);
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    console.error(
      `[github] ${res.status} ${url} ` +
      (env.githubToken ? '(token set) ' : '(no token) ') +
      `body: ${text}`,
    );
    if (res.status === 404) {
      throw new Error(
        `GitHub API 404: repo not found or not accessible: ${url}. ` +
        'Check owner/repo spelling (URL is case-sensitive).',
      );
    }
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        `GitHub API rate limit hit (${res.status}). ` +
        (env.githubToken
          ? 'Token rate limit exceeded — retry later.'
          : 'Set GITHUB_TOKEN env var (60/hour without token, 5000/hour with token).'),
      );
    }
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res;
}

export async function fetchRepoMeta(
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}`);
  const data = await res.json();
  return {
    owner,
    repo,
    defaultBranch: data.default_branch ?? 'main',
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    htmlUrl: data.html_url,
  };
}

export async function downloadRepoZip(
  owner: string,
  repo: string,
  branch: string,
): Promise<Buffer> {
  const res = await ghFetch(
    `${GH_API}/repos/${owner}/${repo}/zip/${branch}`,
  );
  return Buffer.from(await res.arrayBuffer());
}

export async function ingestGitHubRepo(
  repoUrl: string,
): Promise<{ meta: RepoMeta; files: RepoFile[] }> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const meta = await fetchRepoMeta(owner, repo);
  const zipBuf = await downloadRepoZip(owner, repo, meta.defaultBranch);
  const files = extractCodeFiles(zipBuf);
  return { meta, files };
}
