import { createSessionCookie, verifyPassword } from '@/lib/auth';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.resetAt > now && current.count >= 5) return Response.json({ error: '尝试次数过多，请 15 分钟后再试。' }, { status: 429 });
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== 'string' || body.password.length > 200) return Response.json({ error: '请输入团队密码。' }, { status: 400 });
    if (!(await verifyPassword(body.password))) {
      const active = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
      attempts.set(ip, { ...active, count: active.count + 1 });
      return Response.json({ error: '团队密码不正确。' }, { status: 401 });
    }
    attempts.delete(ip);
    return Response.json({ ok: true }, { headers: { 'set-cookie': await createSessionCookie(), 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '登录失败。' }, { status: 500 });
  }
}
