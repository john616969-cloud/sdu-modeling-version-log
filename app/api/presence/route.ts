import { getSession } from '@/lib/auth';
import { teamConfig } from '@/lib/config';
import { getPresenceSummary, recordPresence } from '@/lib/github';

const privateHeaders = { 'cache-control': 'private, no-store' };

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401, headers: privateHeaders });
  try {
    await recordPresence({ member: session.member, sessionId: session.sessionId });
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    console.error('Failed to record presence heartbeat', error);
    return Response.json({ error: '在线状态暂时无法更新。' }, { status: 503, headers: privateHeaders });
  }
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401, headers: privateHeaders });
  if (session.role !== 'admin') return Response.json({ error: '无权查看成员在线记录。' }, { status: 403, headers: privateHeaders });
  try {
    return Response.json(await getPresenceSummary(teamConfig().members), { headers: privateHeaders });
  } catch (error) {
    console.error('Failed to read presence records', error);
    return Response.json({ error: '成员在线记录暂时无法读取。' }, { status: 503, headers: privateHeaders });
  }
}
