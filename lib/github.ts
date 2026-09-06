import { categoryFolders, githubConfig } from '@/lib/config';
import type { Category, Summary, VersionEntry } from '@/lib/types';

type GitHubFile = { sha: string; content?: string; encoding?: string; download_url?: string | null; name?: string };
type LogIndex = { entries: VersionEntry[] };
type CategoryState = Partial<Record<Category, { version: string; repository_path: string | null; event_id: string }>>;

function encodePath(path: string) { return path.split('/').map(encodeURIComponent).join('/'); }

async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = githubConfig();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'sdu-modeling-version-log');
  headers.set('content-type', 'application/json');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const message = response.status === 404 ? 'not_found' : `GitHub 请求失败（${response.status}）`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response.json() as Promise<T>;
}

function fromBase64(value: string) {
  const binary = atob(value.replace(/\n/g, ''));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64(bytes: Uint8Array) {
  let result = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return btoa(result);
}

async function readFile(path: string, ref?: string): Promise<GitHubFile | null> {
  const { repository, branch } = githubConfig();
  try { return await github<GitHubFile>(`/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref ?? branch)}`); }
  catch (error) { if ((error as { status?: number }).status === 404) return null; throw error; }
}

async function readJson<T>(path: string, ref?: string, fallback?: T): Promise<T> {
  const file = await readFile(path, ref);
  if (!file?.content) {
    if (fallback !== undefined) return fallback;
    throw new Error(`仓库文件缺失：${path}`);
  }
  return JSON.parse(new TextDecoder().decode(fromBase64(file.content))) as T;
}

export async function getSummary(): Promise<Summary> {
  const { members, paperOwner } = await import('@/lib/config').then(({ teamConfig }) => teamConfig());
  if (members.length === 0 || !paperOwner || !members.includes(paperOwner)) throw new Error('团队成员或论文负责人尚未正确配置。');
  const index = await readJson<LogIndex>('logs/index.json', undefined, { entries: [] });
  const latest: Summary['latest'] = {};
  for (const entry of index.entries) if (!latest[entry.category]) latest[entry.category] = entry;
  const { repository } = githubConfig();
  return { members, paperOwner, latest, entries: index.entries, repositoryUrl: `https://github.com/${repository}` };
}

export function safeName(name: string) {
  const replaced = Array.from(name.normalize('NFKC'), (character) => character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character) ? '-' : character).join('');
  const cleaned = replaced.replace(/\s+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.-]+|[-]+$/g, '');
  return cleaned.slice(0, 120) || 'file';
}

export function nextVersion(entries: VersionEntry[], category: Category) {
  const number = entries.filter((entry) => entry.category === category).reduce((max, entry) => Math.max(max, Number(entry.version.replace(/^v/, '')) || 0), 0) + 1;
  return `v${String(number).padStart(3, '0')}`;
}

function beijingTimestamp() {
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${formatter.format(new Date()).replace(' ', 'T')}+08:00`;
}

async function sha256(bytes: Uint8Array) {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', source));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function commitEntries(args: { member: string; category: Category; description: string; originalName: string; bytes?: Uint8Array; sourcePath?: string; sourceEventId?: string }) {
  const { repository, branch } = githubConfig();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = await github<{ object: { sha: string } }>(`/repos/${repository}/git/ref/heads/${encodePath(branch)}`);
    const parentSha = reference.object.sha;
    const parent = await github<{ tree: { sha: string } }>(`/repos/${repository}/git/commits/${parentSha}`);
    const index = await readJson<LogIndex>('logs/index.json', parentSha, { entries: [] });
    const version = nextVersion(index.entries, args.category);
    const repositoryPath = `${categoryFolders[args.category]}/${args.category}-${version}-${safeName(args.originalName)}`;
    let fileBlobSha: string;
    let sizeBytes: number;
    let digest: string;
    if (args.bytes) {
      fileBlobSha = (await github<{ sha: string }>(`/repos/${repository}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: toBase64(args.bytes), encoding: 'base64' }) })).sha;
      sizeBytes = args.bytes.byteLength;
      digest = await sha256(args.bytes);
    } else {
      const source = await readFile(args.sourcePath ?? '', parentSha);
      if (!source) throw new Error('要恢复的历史文件不存在。');
      fileBlobSha = source.sha;
      const sourceEntry = index.entries.find((entry) => entry.repository_path === args.sourcePath);
      sizeBytes = sourceEntry?.size_bytes ?? 0;
      digest = sourceEntry?.sha256 ?? '';
    }
    const eventId = crypto.randomUUID();
    const timestamp = beijingTimestamp();
    const entry: VersionEntry = { event_id: eventId, event_type: args.bytes ? 'upload' : 'restore', category: args.category, version, member: args.member, timestamp_beijing: timestamp, original_name: args.originalName, repository_path: repositoryPath, size_bytes: sizeBytes, sha256: digest, description: args.description, source_event_id: args.sourceEventId ?? null, external_url: null, commit_sha: null };
    const entries = [entry, ...index.entries].slice(0, 500);
    const state: CategoryState = {};
    for (const item of entries) if (!state[item.category]) state[item.category] = { version: item.version, repository_path: item.repository_path, event_id: item.event_id };
    const textBlobs = await Promise.all([
      github<{ sha: string }>(`/repos/${repository}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: JSON.stringify(entry, null, 2) + '\n', encoding: 'utf-8' }) }),
      github<{ sha: string }>(`/repos/${repository}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: JSON.stringify({ entries }, null, 2) + '\n', encoding: 'utf-8' }) }),
      github<{ sha: string }>(`/repos/${repository}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: JSON.stringify(state, null, 2) + '\n', encoding: 'utf-8' }) }),
    ]);
    const logPath = `logs/entries/${timestamp.replace(/[-:+]/g, '').replace('T', '-')}-${eventId.slice(0, 8)}-${args.category}-${version}.json`;
    const tree = await github<{ sha: string }>(`/repos/${repository}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: [
      { path: repositoryPath, mode: '100644', type: 'blob', sha: fileBlobSha },
      { path: logPath, mode: '100644', type: 'blob', sha: textBlobs[0].sha },
      { path: 'logs/index.json', mode: '100644', type: 'blob', sha: textBlobs[1].sha },
      { path: 'state/categories.json', mode: '100644', type: 'blob', sha: textBlobs[2].sha },
    ] }) });
    const commit = await github<{ sha: string }>(`/repos/${repository}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `[${args.member}] ${args.category} ${version}: ${args.description.slice(0, 60)}`, tree: tree.sha, parents: [parentSha] }) });
    try {
      await github(`/repos/${repository}/git/refs/heads/${encodePath(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
      return { ...entry, commit_sha: commit.sha };
    } catch (error) { if ((error as { status?: number }).status !== 422 || attempt === 2) throw error; }
  }
  throw new Error('多人同时上传导致冲突，请重试。');
}

export async function uploadVersion(args: { member: string; category: Category; description: string; originalName: string; bytes: Uint8Array }) { return commitEntries(args); }

export async function restoreVersion(args: { eventId: string; member: string }) {
  const summary = await getSummary();
  const source = summary.entries.find((entry) => entry.event_id === args.eventId);
  if (!source?.repository_path) throw new Error('找不到要恢复的历史版本。');
  return commitEntries({ member: args.member, category: source.category, description: `恢复 ${source.version}：${source.description}`, originalName: source.original_name, sourcePath: source.repository_path, sourceEventId: source.event_id });
}

export async function downloadFile(path: string) {
  const allowedPrefix = ['papers/', 'code/', 'data/', 'images/', 'other/'].some((prefix) => path.startsWith(prefix));
  if (!allowedPrefix || path.includes('..') || Array.from(path).some((character) => character.charCodeAt(0) < 32)) throw new Error('文件路径无效。');
  const file = await readFile(path);
  if (!file) throw Object.assign(new Error('文件不存在。'), { status: 404 });
  let bytes: Uint8Array;
  if (file.content) bytes = fromBase64(file.content);
  else if (file.download_url) {
    const { token } = githubConfig();
    const response = await fetch(file.download_url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('下载文件失败。');
    bytes = new Uint8Array(await response.arrayBuffer());
  } else throw new Error('GitHub 未返回文件内容。');
  return { bytes, name: file.name ?? path.split('/').at(-1) ?? 'download' };
}
