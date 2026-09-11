import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '@/lib/types';
import { newVersionNotice } from '@/lib/version-refresh';

const entry = (id: string, member = '陈鑫'): VersionEntry => ({ event_id: id, event_type: 'upload', category: 'code', version: `v00${id}`, member, timestamp_beijing: '2026-09-12T12:00:00+08:00', original_name: 'code.zip', repository_path: 'code/code.zip', size_bytes: 1, sha256: 'a', description: '更新代码', source_event_id: null, external_url: null });

describe('new version notification', () => {
  it('does not notify on initial load or unchanged data', () => {
    expect(newVersionNotice(null, [entry('2')])).toBeNull();
    expect(newVersionNotice('2', [entry('2')])).toBeNull();
  });

  it('describes one or several new entries', () => {
    expect(newVersionNotice('1', [entry('2'), entry('1')])).toContain('陈鑫上传了代码 v002');
    expect(newVersionNotice('1', [entry('3'), entry('2'), entry('1')])).toContain('2 条新记录');
  });
});
