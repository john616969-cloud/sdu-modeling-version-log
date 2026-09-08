import { getSession } from '@/lib/auth';
import { getSummary } from '@/lib/github';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  try { return Response.json({ ...await getSummary(), viewer: { member: session.member, role: session.role } }, { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : '无法读取版本日志。' }, { status: 503 }); }
}
