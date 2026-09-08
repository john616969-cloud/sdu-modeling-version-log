import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const downloadFile = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('@/lib/auth', () => ({ getSession }));
vi.mock('@/lib/github', () => ({ downloadFile, recordAuditEvent }));

describe('download audit behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSession.mockResolvedValue({ member: '陈鑫', role: 'member', exp: Date.now() / 1000 + 60 });
    recordAuditEvent.mockResolvedValue(undefined);
  });

  it('records a completed file download', async () => {
    downloadFile.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), name: 'code.zip' });
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/files?path=code%2Fcode-v001-code.zip'));
    expect(response.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith({ event_type: 'download', member: '陈鑫', original_name: 'code.zip', repository_path: 'code/code-v001-code.zip' });
  });

  it('does not record a missing or failed file download', async () => {
    downloadFile.mockRejectedValue(Object.assign(new Error('文件不存在。'), { status: 404 }));
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/files?path=code%2Fmissing.zip'));
    expect(response.status).toBe(404);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
