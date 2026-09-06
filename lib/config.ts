import type { Category } from '@/lib/types';

export const categories: Category[] = ['paper-main', 'paper-revision', 'code', 'data', 'image', 'other'];

export const categoryFolders: Record<Category, string> = {
  'paper-main': 'papers/main',
  'paper-revision': 'papers/revisions',
  code: 'code',
  data: 'data',
  image: 'images',
  other: 'other',
};

export function teamConfig() {
  const members = (process.env.TEAM_MEMBERS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  const paperOwner = process.env.PAPER_OWNER?.trim() ?? '';
  return { members, paperOwner };
}

export function githubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPO?.trim();
  const branch = process.env.GITHUB_BRANCH?.trim() || 'main';
  if (!token || !repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('网站尚未连接 GitHub 仓库，请联系管理员完成配置。');
  }
  return { token, repository, branch };
}

export function isCategory(value: string): value is Category {
  return categories.includes(value as Category);
}
