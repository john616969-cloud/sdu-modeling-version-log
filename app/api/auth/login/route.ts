import { authenticateMember, createSessionCookie } from '@/lib/auth';
import { teamConfig } from '@/lib/config';
import { recordAuditEvent } from '@/lib/github';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export async function GET() {
  return Response.json({ members: teamConfig().members }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && current.resetAt > now && current.count >= 5) return Response.json({ error: '尝试次数过多，请 15 分钟后再试。' }, { status: 429 });
  try {
    const body = await request.json() as { member?: unknown; password?: unknown };
    const member = typeof body.member === 'string' ? body.member.trim() : '';
    if (!teamConfig().members.includes(member) || typeof body.password !== 'string' || body.password.length > 200) return Response.json({ error: '请选择姓名并输入密码。' }, { status: 400 });
    const role = await authenticateMember(member, body.password);
    if (!role) {
      const active = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
      attempts.set(ip, { ...active, count: active.count + 1 });
      return Response.json({ error: '登录密码不正确。' }, { status: 401 });
    }
    attempts.delete(ip);
    const cookie = await createSessionCookie({ member, role });
    try { await recordAuditEvent({ event_type: 'login', member }); }
    catch (auditError) { console.error('Failed to record login audit event', auditError); }
    return Response.json({ ok: true }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '登录失败。' }, { status: 500 });
  }
}
