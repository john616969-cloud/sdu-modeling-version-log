import { requireSession } from '@/lib/auth';
import { downloadFile } from '@/lib/github';

export async function GET(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const { bytes, name } = await downloadFile(path);
    const dispositionName = encodeURIComponent(name);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${dispositionName}`, 'cache-control': 'private, no-store' } });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    return Response.json({ error: error instanceof Error ? error.message : '下载失败。' }, { status });
  }
}
