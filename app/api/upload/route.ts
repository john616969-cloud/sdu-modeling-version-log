import { requireSession } from '@/lib/auth';
import { isCategory, teamConfig } from '@/lib/config';
import { uploadVersion } from '@/lib/github';

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = await requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const memberValue = form.get('member');
    const categoryValue = form.get('category');
    const descriptionValue = form.get('description');
    const member = typeof memberValue === 'string' ? memberValue.trim() : '';
    const category = typeof categoryValue === 'string' ? categoryValue : '';
    const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : '';
    const file = form.get('file');
    const { members, paperOwner } = teamConfig();
    if (!members.includes(member)) return Response.json({ error: '请选择有效的团队成员。' }, { status: 400 });
    if (!isCategory(category)) return Response.json({ error: '请选择有效的文件类别。' }, { status: 400 });
    if (category === 'paper-main' && member !== paperOwner) return Response.json({ error: '只有论文负责人可以上传论文主稿。' }, { status: 403 });
    if (description.length < 4 || description.length > 500) return Response.json({ error: '修改说明需要 4—500 个字符。' }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: '请选择非空文件。' }, { status: 400 });
    if (file.size > MAX_SIZE) return Response.json({ error: '单个文件不能超过 20 MB。' }, { status: 413 });
    const entry = await uploadVersion({ member, category, description, originalName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    return Response.json({ entry }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : '上传失败。' }, { status: 502 }); }
}
