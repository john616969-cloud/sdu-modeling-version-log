import { requireSession } from '@/lib/auth';
import { getSummary } from '@/lib/github';

export async function GET(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try { return Response.json(await getSummary(), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : '无法读取版本日志。' }, { status: 503 }); }
}
