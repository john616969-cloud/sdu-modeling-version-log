export type Category = 'paper-main' | 'paper-revision' | 'code' | 'data' | 'image' | 'other';

export type VersionEntry = {
  event_id: string;
  event_type: 'upload' | 'restore' | 'external_link';
  category: Category;
  version: string;
  member: string;
  timestamp_beijing: string;
  original_name: string;
  repository_path: string | null;
  size_bytes: number;
  sha256: string;
  description: string;
  source_event_id: string | null;
  external_url: string | null;
  commit_sha?: string | null;
};

export type Summary = {
  members: string[];
  paperOwner: string;
  latest: Partial<Record<Category, VersionEntry>>;
  entries: VersionEntry[];
  repositoryUrl?: string;
};
