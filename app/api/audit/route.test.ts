import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '@/lib/types';

const getSession = vi.fn();
const getAuditEvents = vi.fn();

vi.mock('@/lib/auth', () => ({ getSession }));
vi.mock('@/lib/github', () => ({ getAuditEvents }));

const events: AuditEvent[] = [
  { event_id: 'login-1', event_type: 'login', member: '张怡慧', timestamp_beijing: '2026-09-08T18:00:00+08:00', original_name: null, repository_path: null, version: null, category: null },
  { event_id: 'download-1', event_type: 'download', member: '陈鑫', timestamp_beijing: '2026-09-08T18:01:00+08:00', original_name: 'code.zip', repository_path: 'code/code-v001-code.zip', version: 'v001', category: 'code' },
];

describe('audit API permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuditEvents.mockResolvedValue(events);
  });

  it('rejects anonymous requests', async () => {
    getSession.mockResolvedValue(null);
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/audit'));
    expect(response.status).toBe(401);
  });

  it('returns only download events to regular members', async () => {
    getSession.mockResolvedValue({ member: '陈鑫', role: 'member', exp: Date.now() / 1000 + 60 });
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/audit'));
    const body = await response.json() as { events: AuditEvent[] };
    expect(body.events.map((event) => event.event_type)).toEqual(['download']);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns login and download events to the administrator', async () => {
    getSession.mockResolvedValue({ member: '张怡慧', role: 'admin', exp: Date.now() / 1000 + 60 });
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/audit'));
    const body = await response.json() as { events: AuditEvent[] };
    expect(body.events.map((event) => event.event_type)).toEqual(['login', 'download']);
  });
});
