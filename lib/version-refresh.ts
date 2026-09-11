import type { VersionEntry } from '@/lib/types';

const labels = { 'paper-main': '论文主稿', 'paper-revision': '论文修改稿', code: '代码', data: '数据', image: '图片', other: '其他' } as const;

export function newVersionNotice(previousEventId: string | null, entries: VersionEntry[]) {
  if (!previousEventId || entries[0]?.event_id === previousEventId) return null;
  const previousIndex = entries.findIndex((entry) => entry.event_id === previousEventId);
  const count = previousIndex > 0 ? previousIndex : 1;
  const latest = entries[0];
  if (!latest) return null;
  const action = latest.event_type === 'restore' ? '恢复了' : '上传了';
  const detail = `${latest.member}${action}${labels[latest.category]} ${latest.version}`;
  return count === 1 ? `${detail}，列表已自动刷新。` : `${detail} 等 ${count} 条新记录，列表已自动刷新。`;
}
