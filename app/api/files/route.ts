import { getSession } from '@/lib/auth';
import { downloadFile, recordAuditEvent } from '@/lib/github';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401, headers: { 'cache-control': 'private, no-store' } });
  try {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const { bytes, name } = await downloadFile(path);
    try { await recordAuditEvent({ event_type: 'download', member: session.member, original_name: name, repository_path: path }); }
    catch (auditError) { console.error('Failed to record download audit event', auditError); }
    const dispositionName = encodeURIComponent(name);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${dispositionName}`, 'cache-control': 'private, no-store' } });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    return Response.json({ error: error instanceof Error ? error.message : '下载失败。' }, { status });
  }
}
