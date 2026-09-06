import { requireSession } from '@/lib/auth';
import { teamConfig } from '@/lib/config';
import { getSummary, restoreVersion } from '@/lib/github';

export async function POST(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { eventId?: unknown; member?: unknown };
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const member = typeof body.member === 'string' ? body.member.trim() : '';
    const { members, paperOwner } = teamConfig();
    if (!members.includes(member)) return Response.json({ error: '请选择有效的团队成员。' }, { status: 400 });
    const source = (await getSummary()).entries.find((entry) => entry.event_id === eventId);
    if (!source) return Response.json({ error: '找不到要恢复的版本。' }, { status: 404 });
    if (source.category === 'paper-main' && member !== paperOwner) return Response.json({ error: '只有论文负责人可以恢复论文主稿。' }, { status: 403 });
    const entry = await restoreVersion({ eventId, member });
    return Response.json({ entry }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : '恢复失败。' }, { status: 502 }); }
}
