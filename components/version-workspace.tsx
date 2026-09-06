'use client';

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  ArchiveRestore, CheckCircle2, Clock3, Code2, Download, FileArchive,
  FileText, GitCommitHorizontal, LogOut, Menu, Plus, RefreshCw, Search,
  ShieldCheck, UploadCloud, Users, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Category, Summary, VersionEntry } from '@/lib/types';

const categoryLabels: Record<Category, string> = {
  'paper-main': '论文主稿', 'paper-revision': '论文修改稿', code: '代码',
  data: '数据', image: '图片', other: '其他',
};

const demoEntries: VersionEntry[] = [
  { event_id: 'demo-3', event_type: 'upload', category: 'paper-main', version: 'v012', member: '成员一', timestamp_beijing: '2026-09-06T15:42:00+08:00', original_name: '论文主稿.docx', repository_path: 'papers/main/paper-main-v012-论文主稿.docx', size_bytes: 2840192, sha256: 'demo', description: '补全模型检验与灵敏度分析，统一图表编号。', source_event_id: null, external_url: null },
  { event_id: 'demo-2', event_type: 'upload', category: 'code', version: 'v027', member: '成员二', timestamp_beijing: '2026-09-06T15:18:00+08:00', original_name: 'model-code.zip', repository_path: 'code/code-v027-model-code.zip', size_bytes: 935221, sha256: 'demo', description: '加入参数敏感性批量实验，修复随机种子未固定。', source_event_id: null, external_url: null },
  { event_id: 'demo-1', event_type: 'upload', category: 'paper-revision', version: 'v008', member: '成员三', timestamp_beijing: '2026-09-06T14:56:00+08:00', original_name: '第五节修改建议.docx', repository_path: 'papers/revisions/paper-revision-v008-第五节修改建议.docx', size_bytes: 481220, sha256: 'demo', description: '标注第五节三处表述问题，待成员一合并。', source_event_id: null, external_url: null },
];

const demoSummary: Summary = {
  members: ['成员一', '成员二', '成员三'], paperOwner: '成员一',
  latest: { 'paper-main': demoEntries[0], code: demoEntries[1], 'paper-revision': demoEntries[2] }, entries: demoEntries,
};

async function responseError(response: Response, fallback: string) {
  const body = await response.json() as { error?: unknown };
  return typeof body.error === 'string' ? body.error : fallback;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function LatestCard({ entry, kind }: { entry?: VersionEntry; kind: 'paper' | 'code' }) {
  const isPaper = kind === 'paper';
  const Icon = isPaper ? FileText : Code2;
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-[0_14px_40px_rgb(18_45_85/6%)] sm:p-6">
      <div className={`absolute inset-y-0 left-0 w-1 ${isPaper ? 'bg-blue-600' : 'bg-amber-400'}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid size-11 place-items-center rounded-xl ${isPaper ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}><Icon className="size-5" /></div>
          <div><p className="text-sm text-muted-foreground">{isPaper ? '最新论文主稿' : '最新代码包'}</p><h2 className="mt-0.5 text-xl font-bold tracking-tight">{entry?.version ?? '尚未上传'}</h2></div>
        </div>
        {entry && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">已同步</Badge>}
      </div>
      {entry ? <>
        <p className="mt-5 line-clamp-2 min-h-12 text-[15px] leading-6">{entry.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="size-4" />{entry.member}</span><span className="flex items-center gap-1.5"><Clock3 className="size-4" />{formatTime(entry.timestamp_beijing)}</span></div>
        <Button nativeButton={false} className="mt-5 h-10 w-full sm:w-auto" render={<a aria-label={`下载 ${entry.version}`} href={`/api/files?path=${encodeURIComponent(entry.repository_path ?? '')}`} />}><Download />下载这一版</Button>
      </> : <p className="mt-5 text-sm text-muted-foreground">完成第一次上传后，这里会固定显示团队认可的最新版本。</p>}
    </article>
  );
}

function LoginPanel({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error(await responseError(response, '密码不正确'));
      onSuccess();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '登录失败'); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center px-5 py-10"><section className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-[0_30px_90px_rgb(20_54_100/15%)]"><div className="bg-[#15355f] px-7 py-8 text-white"><div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-[#15355f]"><GitCommitHorizontal /></div><span className="text-sm font-semibold tracking-[0.16em] text-blue-100">2026 · 数学建模</span></div><h1 className="text-3xl font-bold tracking-tight">数模版本站</h1><p className="mt-2 text-base leading-7 text-blue-100">统一上传，自动编号。只从这里拿最新版。</p></div><form onSubmit={login} className="space-y-5 p-7"><div><label htmlFor="password" className="mb-2 block text-sm font-medium">团队公共密码</label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" required /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? <RefreshCw className="animate-spin" /> : <ShieldCheck />}{busy ? '正在验证' : '进入版本站'}</Button><p className="text-center text-xs leading-5 text-muted-foreground">登录后将在此设备保持 7 天。使用公共电脑时请主动退出。</p></form></section></main>;
}

export function VersionWorkspace({ preview }: { preview: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(preview ? demoSummary : null);
  const [authenticated, setAuthenticated] = useState(preview);
  const [loading, setLoading] = useState(!preview);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [restoreEntry, setRestoreEntry] = useState<VersionEntry | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [category, setCategory] = useState<'all' | Category>('all');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/summary', { cache: 'no-store' });
      if (response.status === 401) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error(await responseError(response, '加载失败'));
      setSummary(await response.json()); setAuthenticated(true);
    } catch (reason) { if (!preview) setNotice(reason instanceof Error ? reason.message : '加载失败'); }
    finally { setLoading(false); }
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    const timer = window.setTimeout(() => { void loadSummary(); }, 0);
    return () => window.clearTimeout(timer);
  }, [preview, loadSummary]);
  const entries = useMemo(() => (summary?.entries ?? []).filter((entry) => {
    const categoryMatches = category === 'all' || entry.category === category;
    const text = `${entry.version} ${entry.member} ${entry.original_name} ${entry.description}`.toLowerCase();
    return categoryMatches && text.includes(query.toLowerCase());
  }), [category, query, summary]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'list_visible_versions', title: '读取当前版本列表',
      description: '读取当前筛选后可见的版本记录，不修改任何数据。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (typeof input !== 'object' || input === null || Array.isArray(input) || Object.keys(input).length > 0) throw new Error('参数必须是空对象。');
        return entries.map(({ event_id, category: itemCategory, version, member, timestamp_beijing, original_name, description }) => ({ event_id, category: itemCategory, version, member, timestamp_beijing, original_name, description }));
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: 'start_version_upload', title: '打开版本上传',
      description: '打开页面中的新版本上传表单，但不会提交文件。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (typeof input !== 'object' || input === null || Array.isArray(input) || Object.keys(input).length > 0) throw new Error('参数必须是空对象。');
        setUploadOpen(true); return { opened: true };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [entries]);
  if (loading && !summary) return <main className="grid min-h-screen place-items-center"><RefreshCw className="size-7 animate-spin text-primary" /><span className="sr-only">正在加载</span></main>;
  if (!authenticated) return <LoginPanel onSuccess={() => void loadSummary()} />;
  return <div className="min-h-screen">
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#15355f] text-amber-300"><GitCommitHorizontal className="size-5" /></div><div><p className="font-bold leading-5">数模版本站</p><p className="text-xs text-muted-foreground">2026 高教社杯</p></div></div><div className="hidden items-center gap-3 sm:flex"><span className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500" />GitHub 已连接</span><Button variant="ghost" size="icon" aria-label="退出登录" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setAuthenticated(false); }}><LogOut /></Button></div><Button className="sm:hidden" variant="ghost" size="icon" aria-label="打开菜单" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</Button></div>{mobileOpen && <div className="border-t bg-card px-4 py-3 sm:hidden"><Button variant="ghost" className="w-full justify-start" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setAuthenticated(false); }}><LogOut />退出登录</Button></div>}</header>
    <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="size-4" />资料已按版本归档</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">今天交付哪一版？</h1><p className="mt-2 text-base text-muted-foreground">主稿和代码以本页显示的版本为准。</p></div><Button size="lg" className="h-11 px-5 shadow-lg shadow-blue-900/10" onClick={() => setUploadOpen(true)}><Plus />上传新版本</Button></section>
      {notice && <output className="mt-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示"><X className="size-4" /></button></output>}
      <section className="mt-7 grid gap-4 lg:grid-cols-2"><LatestCard entry={summary?.latest['paper-main']} kind="paper" /><LatestCard entry={summary?.latest.code} kind="code" /></section>
      <section className="mt-9 overflow-hidden rounded-2xl border bg-card shadow-[0_14px_40px_rgb(18_45_85/5%)]"><div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">版本日志</h2><p className="mt-1 text-sm text-muted-foreground">每次上传和恢复都会留下记录。</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="搜索日志" placeholder="搜索版本、成员或说明" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 pl-9 sm:w-60" /></div><Select value={category} onValueChange={(value) => setCategory(typeof value === 'string' ? value as 'all' | Category : 'all')}><SelectTrigger className="h-9 w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部类别</SelectItem>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead className="pl-5">版本</TableHead><TableHead>文件与说明</TableHead><TableHead>成员</TableHead><TableHead>时间</TableHead><TableHead className="pr-5 text-right">操作</TableHead></TableRow></TableHeader><TableBody>{entries.map((entry) => <TableRow key={entry.event_id}><TableCell className="pl-5"><div className="flex items-center gap-2"><Badge variant="outline">{entry.version}</Badge><span className="text-xs text-muted-foreground">{categoryLabels[entry.category]}</span></div></TableCell><TableCell className="max-w-md whitespace-normal"><p className="font-medium">{entry.original_name}</p><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{entry.description}</p></TableCell><TableCell>{entry.member}</TableCell><TableCell className="text-muted-foreground">{formatTime(entry.timestamp_beijing)}</TableCell><TableCell className="pr-5 text-right"><Button nativeButton={false} variant="ghost" size="icon-sm" aria-label={`下载 ${entry.version}`} render={<a aria-label={`下载 ${entry.version}`} href={`/api/files?path=${encodeURIComponent(entry.repository_path ?? '')}`} />}><Download /></Button><Button variant="ghost" size="icon-sm" aria-label={`恢复 ${entry.version}`} onClick={() => setRestoreEntry(entry)}><ArchiveRestore /></Button></TableCell></TableRow>)}</TableBody></Table></div>
        <div className="divide-y md:hidden">{entries.map((entry) => <article key={entry.event_id} className="p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline">{entry.version}</Badge><span className="text-xs text-muted-foreground">{categoryLabels[entry.category]}</span></div><span className="text-xs text-muted-foreground">{formatTime(entry.timestamp_beijing)}</span></div><h3 className="mt-3 font-medium">{entry.original_name}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.description}</p><div className="mt-3 flex items-center justify-between"><span className="text-sm">{entry.member} · {formatSize(entry.size_bytes)}</span><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setRestoreEntry(entry)}><ArchiveRestore />恢复</Button><Button nativeButton={false} size="sm" variant="outline" render={<a aria-label={`下载 ${entry.version}`} href={`/api/files?path=${encodeURIComponent(entry.repository_path ?? '')}`} />}><Download />下载</Button></div></div></article>)}</div>
        {entries.length === 0 && <div className="grid place-items-center px-5 py-16 text-center"><FileArchive className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">没有匹配的版本</p><p className="mt-1 text-sm text-muted-foreground">换一个类别或搜索词试试。</p></div>}
      </section></main>
    <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} summary={summary ?? demoSummary} preview={preview} onUploaded={() => { setUploadOpen(false); setNotice('新版本已提交到 GitHub。'); void loadSummary(); }} />
    <RestoreDialog entry={restoreEntry} onOpenChange={(open) => { if (!open) setRestoreEntry(null); }} summary={summary ?? demoSummary} preview={preview} onRestored={() => { setRestoreEntry(null); setNotice('历史文件已恢复为新的最新版本。'); void loadSummary(); }} />
  </div>;
}

function UploadDialog({ open, onOpenChange, summary, preview, onUploaded }: { open: boolean; onOpenChange: (open: boolean) => void; summary: Summary; preview: boolean; onUploaded: () => void }) {
  const [member, setMember] = useState(summary.members[0] ?? '');
  const [category, setCategory] = useState<Category>('paper-revision');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canUploadMain = member === summary.paperOwner;
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!file) return setError('请选择要上传的文件');
    if (file.size > 20 * 1024 * 1024) return setError('单个文件不能超过 20 MB');
    if (description.trim().length < 4) return setError('请具体说明这次修改了什么');
    if (category === 'paper-main' && !canUploadMain) return setError('只有论文负责人可以上传论文主稿');
    if (preview) { setError('预览模式不会写入仓库，部署配置完成后即可上传。'); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.set('member', member); form.set('category', category); form.set('description', description); form.set('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: form });
      if (!response.ok) throw new Error(await responseError(response, '上传失败'));
      onUploaded(); setDescription(''); setFile(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '上传失败'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle className="text-xl">上传新版本</DialogTitle><DialogDescription>提交成功后会自动生成版本号并写入 GitHub，已有文件不会被覆盖。</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div><p className="mb-2 text-sm font-medium">上传成员</p><Select value={member} onValueChange={(value) => setMember(typeof value === 'string' ? value : '')}><SelectTrigger aria-label="上传成员" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{summary.members.map((name) => <SelectItem value={name} key={name}>{name}</SelectItem>)}</SelectContent></Select></div><div><p className="mb-2 text-sm font-medium">文件类别</p><Select value={category} onValueChange={(value) => { if (typeof value === 'string') setCategory(value as Category); }}><SelectTrigger aria-label="文件类别" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem value={value} key={value} disabled={value === 'paper-main' && !canUploadMain}>{label}</SelectItem>)}</SelectContent></Select></div><div><label htmlFor="file" className="mb-2 block text-sm font-medium">选择文件</label><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/35 px-4 text-center transition hover:border-primary/50 hover:bg-muted/60"><UploadCloud className="mb-2 size-7 text-primary" /><span className="text-sm font-medium">{file ? file.name : '点击选择文件'}</span><span className="mt-1 text-xs text-muted-foreground">最大 20 MB；代码请先打包为 ZIP</span><input id="file" type="file" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></div><div><label htmlFor="description" className="mb-2 block text-sm font-medium">修改说明</label><Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：补全模型检验，修正表 3 单位，待检查参考文献。" className="min-h-24" /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={busy}>{busy ? <RefreshCw className="animate-spin" /> : <UploadCloud />}{busy ? '正在提交' : '确认上传'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function RestoreDialog({ entry, onOpenChange, summary, preview, onRestored }: { entry: VersionEntry | null; onOpenChange: (open: boolean) => void; summary: Summary; preview: boolean; onRestored: () => void }) {
  const [member, setMember] = useState(summary.members[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function restore() {
    if (!entry) return;
    if (entry.category === 'paper-main' && member !== summary.paperOwner) return setError('只有指定成员可以恢复论文主稿。');
    if (preview) return setError('预览模式不会写入仓库，部署配置完成后即可恢复。');
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: entry.event_id, member }) });
      if (!response.ok) throw new Error(await responseError(response, '恢复失败'));
      onRestored();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '恢复失败'); }
    finally { setBusy(false); }
  }
  return <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>恢复历史版本</DialogTitle><DialogDescription>系统会复制 {entry?.version} 的内容并创建一个新版本，现有记录不会被删除。</DialogDescription></DialogHeader><div><p className="mb-2 text-sm font-medium">操作成员</p><Select value={member} onValueChange={(value) => setMember(typeof value === 'string' ? value : '')}><SelectTrigger aria-label="操作成员" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{summary.members.map((name) => <SelectItem value={name} key={name}>{name}</SelectItem>)}</SelectContent></Select></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={restore} disabled={busy}>{busy ? <RefreshCw className="animate-spin" /> : <ArchiveRestore />}{busy ? '正在恢复' : '恢复为最新版'}</Button></DialogFooter></DialogContent></Dialog>;
}
