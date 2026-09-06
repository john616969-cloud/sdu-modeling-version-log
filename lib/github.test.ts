import { describe, expect, it } from 'vitest';
import { nextVersion, safeName } from '@/lib/github';
import type { VersionEntry } from '@/lib/types';

const base: VersionEntry = {
  event_id: '1', event_type: 'upload', category: 'code', version: 'v009', member: '测试成员',
  timestamp_beijing: '2026-09-06T16:00:00+08:00', original_name: 'code.zip', repository_path: 'code/code-v009-code.zip',
  size_bytes: 10, sha256: 'abc', description: '测试记录', source_event_id: null, external_url: null,
};

describe('GitHub version helpers', () => {
  it('generates the next version inside each category', () => {
    expect(nextVersion([base, { ...base, event_id: '2', version: 'v012' }], 'code')).toBe('v013');
    expect(nextVersion([base], 'paper-main')).toBe('v001');
  });

  it('keeps Chinese names while removing unsafe path characters', () => {
    expect(safeName('论文 主稿:最终版?.docx')).toBe('论文-主稿-最终版-.docx');
    expect(safeName('../../')).toBe('file');
  });
});
