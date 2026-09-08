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
  viewer?: { member: string; role: 'admin' | 'member' };
};

export type AuditEvent = {
  event_id: string;
  event_type: 'login' | 'download';
  member: string;
  timestamp_beijing: string;
  original_name: string | null;
  repository_path: string | null;
  version: string | null;
  category: Category | null;
};

export type PresenceRecord = {
  presence_id: string;
  member: string;
  session_id: string;
  online_at: string;
  last_active_at: string;
};

export type PresenceView = Omit<PresenceRecord, 'session_id'> & { online: boolean };

export type MemberPresence = {
  member: string;
  online: boolean;
  online_at: string | null;
  last_active_at: string | null;
};

export type PresenceSummary = {
  members: MemberPresence[];
  records: PresenceView[];
};
