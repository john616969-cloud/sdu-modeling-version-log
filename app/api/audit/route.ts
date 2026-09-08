import { getSession } from '@/lib/auth';
import { getAuditEvents } from '@/lib/github';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401, headers: { 'cache-control': 'private, no-store' } });
  try {
    const events = await getAuditEvents();
    return Response.json({ events: session.role === 'admin' ? events : events.filter((event) => event.event_type === 'download') }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to read audit events', error);
    return Response.json({ error: '访问日志暂时无法读取，请稍后重试。' }, { status: 503, headers: { 'cache-control': 'private, no-store' } });
  }
}
