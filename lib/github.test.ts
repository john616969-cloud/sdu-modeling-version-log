import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPresenceHeartbeat, buildPresenceSummary, getSummary, nextVersion, prependAuditEvent, safeName } from '@/lib/github';
import type { AuditEvent, PresenceRecord, VersionEntry } from '@/lib/types';

const base: VersionEntry = {
  event_id: '1', event_type: 'upload', category: 'code', version: 'v009', member: '测试成员',
  timestamp_beijing: '2026-09-06T16:00:00+08:00', original_name: 'code.zip', repository_path: 'code/code-v009-code.zip',
  size_bytes: 10, sha256: 'abc', description: '测试记录', source_event_id: null, external_url: null,
};

describe('GitHub version helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO;
    delete process.env.TEAM_MEMBERS;
    delete process.env.PAPER_OWNER;
  });

  it('generates the next version inside each category', () => {
    expect(nextVersion([base, { ...base, event_id: '2', version: 'v012' }], 'code')).toBe('v013');
    expect(nextVersion([base], 'paper-main')).toBe('v001');
  });

  it('keeps Chinese names while removing unsafe path characters', () => {
    expect(safeName('论文 主稿:最终版?.docx')).toBe('论文-主稿-最终版-.docx');
    expect(safeName('../../')).toBe('file');
  });

  it('identifies the app with a User-Agent on GitHub API requests', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'owner/private-repo';
    process.env.TEAM_MEMBERS = '张怡慧';
    process.env.PAPER_OWNER = '张怡慧';
    const content = Buffer.from(JSON.stringify({ entries: [] })).toString('base64');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content, encoding: 'base64' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getSummary();

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('User-Agent')).toBe('sdu-modeling-version-log');
  });

  it('keeps the newest 500 audit events in reverse chronological order', () => {
    const event: AuditEvent = { event_id: 'new', event_type: 'login', member: '张怡慧', timestamp_beijing: '2026-09-08T18:00:00+08:00', original_name: null, repository_path: null, version: null, category: null };
    const oldEvents = Array.from({ length: 500 }, (_, index) => ({ ...event, event_id: `old-${index}` }));
    const result = prependAuditEvent(oldEvents, event);
    expect(result).toHaveLength(500);
    expect(result[0].event_id).toBe('new');
    expect(result.at(-1)?.event_id).toBe('old-498');
  });

  it('creates, deduplicates, updates, and splits presence periods at the configured boundaries', () => {
    const first = applyPresenceHeartbeat([], { member: '陈鑫', sessionId: 'session-a', now: new Date('2026-09-08T10:00:00Z'), presenceId: 'presence-1' });
    expect(first.written).toBe(true);
    expect(first.record.online_at).toBe(first.record.last_active_at);

    const duplicate = applyPresenceHeartbeat(first.records, { member: '陈鑫', sessionId: 'session-a', now: new Date('2026-09-08T10:03:00Z'), presenceId: 'presence-2' });
    expect(duplicate.written).toBe(false);
    expect(duplicate.record.presence_id).toBe('presence-1');

    const updated = applyPresenceHeartbeat(first.records, { member: '陈鑫', sessionId: 'session-a', now: new Date('2026-09-08T10:05:00Z'), presenceId: 'presence-2' });
    expect(updated.written).toBe(true);
    expect(updated.record.presence_id).toBe('presence-1');
    expect(updated.record.last_active_at).not.toBe(updated.record.online_at);

    const resumed = applyPresenceHeartbeat(updated.records, { member: '陈鑫', sessionId: 'session-a', now: new Date('2026-09-08T10:16:01Z'), presenceId: 'presence-2' });
    expect(resumed.record.presence_id).toBe('presence-2');
    expect(resumed.records).toHaveLength(2);
  });

  it('summarizes multiple devices by member without exposing session ids', () => {
    const records: PresenceRecord[] = [
      { presence_id: 'p1', member: '张怡慧', session_id: 'device-1', online_at: '2026-09-08T17:50:00+08:00', last_active_at: '2026-09-08T18:00:00+08:00' },
      { presence_id: 'p2', member: '张怡慧', session_id: 'device-2', online_at: '2026-09-08T17:55:00+08:00', last_active_at: '2026-09-08T18:04:00+08:00' },
      { presence_id: 'p3', member: '陈鑫', session_id: 'device-3', online_at: '2026-09-08T17:00:00+08:00', last_active_at: '2026-09-08T17:10:00+08:00' },
    ];
    const summary = buildPresenceSummary(records, ['张怡慧', '陈鑫', '谷雨蔓'], new Date('2026-09-08T10:05:00Z'));
    expect(summary.members[0]).toMatchObject({ member: '张怡慧', online: true, online_at: '2026-09-08T17:50:00+08:00', last_active_at: '2026-09-08T18:04:00+08:00' });
    expect(summary.members[1].online).toBe(false);
    expect(summary.members[2]).toMatchObject({ online: false, online_at: null, last_active_at: null });
    expect(summary.records[0]).not.toHaveProperty('session_id');
  });

  it('keeps only the newest 500 presence periods', () => {
    const records: PresenceRecord[] = Array.from({ length: 500 }, (_, index) => ({ presence_id: `old-${index}`, member: '陈鑫', session_id: `old-session-${index}`, online_at: new Date(Date.UTC(2026, 8, 8, 0, 0, index)).toISOString(), last_active_at: new Date(Date.UTC(2026, 8, 8, 0, 0, index)).toISOString() }));
    const result = applyPresenceHeartbeat(records, { member: '谷雨蔓', sessionId: 'new-session', now: new Date('2026-09-08T10:00:00Z'), presenceId: 'new-presence' });
    expect(result.records).toHaveLength(500);
    expect(result.records[0].presence_id).toBe('new-presence');
  });
});
