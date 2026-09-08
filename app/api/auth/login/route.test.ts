import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateMember = vi.fn();
const createSessionCookie = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('@/lib/auth', () => ({ authenticateMember, createSessionCookie }));
vi.mock('@/lib/config', () => ({ teamConfig: () => ({ members: ['张怡慧', '陈鑫', '谷雨蔓'], paperOwner: '张怡慧' }) }));
vi.mock('@/lib/github', () => ({ recordAuditEvent }));

describe('login audit behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createSessionCookie.mockResolvedValue('modeling_session=test; Path=/; HttpOnly');
    recordAuditEvent.mockResolvedValue(undefined);
  });

  it('records a successful login with the selected member', async () => {
    authenticateMember.mockResolvedValue('admin');
    const { POST } = await import('./route');
    const response = await POST(new Request('https://example.test/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ member: '张怡慧', password: 'correct' }) }));
    expect(response.status).toBe(200);
    expect(createSessionCookie).toHaveBeenCalledWith({ member: '张怡慧', role: 'admin' });
    expect(recordAuditEvent).toHaveBeenCalledWith({ event_type: 'login', member: '张怡慧' });
  });

  it('does not record a failed login', async () => {
    authenticateMember.mockResolvedValue(null);
    const { POST } = await import('./route');
    const response = await POST(new Request('https://example.test/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ member: '陈鑫', password: 'wrong' }) }));
    expect(response.status).toBe(401);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
