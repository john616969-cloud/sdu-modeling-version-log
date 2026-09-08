import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getPresenceSummary = vi.fn();
const recordPresence = vi.fn();

vi.mock('@/lib/auth', () => ({ getSession }));
vi.mock('@/lib/config', () => ({ teamConfig: () => ({ members: ['张怡慧', '陈鑫', '谷雨蔓'], paperOwner: '张怡慧' }) }));
vi.mock('@/lib/github', () => ({ getPresenceSummary, recordPresence }));

describe('presence API permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    recordPresence.mockResolvedValue({});
    getPresenceSummary.mockResolvedValue({ members: [], records: [] });
  });

  it('records the signed-in member and ignores client identity input', async () => {
    getSession.mockResolvedValue({ member: '陈鑫', role: 'member', sessionId: 'signed-session', exp: Date.now() / 1000 + 60 });
    const { POST } = await import('./route');
    const response = await POST(new Request('https://example.test/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ member: '张怡慧' }) }));
    expect(response.status).toBe(200);
    expect(recordPresence).toHaveBeenCalledWith({ member: '陈鑫', sessionId: 'signed-session' });
  });

  it('allows only administrators to read presence records', async () => {
    const { GET } = await import('./route');
    getSession.mockResolvedValue({ member: '陈鑫', role: 'member', sessionId: 'member-session', exp: Date.now() / 1000 + 60 });
    expect((await GET(new Request('https://example.test/api/presence'))).status).toBe(403);
    expect(getPresenceSummary).not.toHaveBeenCalled();

    getSession.mockResolvedValue({ member: '张怡慧', role: 'admin', sessionId: 'admin-session', exp: Date.now() / 1000 + 60 });
    const response = await GET(new Request('https://example.test/api/presence'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('rejects anonymous heartbeat requests', async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import('./route');
    expect((await POST(new Request('https://example.test/api/presence', { method: 'POST' }))).status).toBe(401);
    expect(recordPresence).not.toHaveBeenCalled();
  });
});
