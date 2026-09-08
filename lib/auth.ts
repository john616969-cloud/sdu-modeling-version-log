const COOKIE_NAME = 'modeling_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export type SessionRole = 'admin' | 'member';
export type Session = { member: string; role: SessionRole; exp: number };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function verifyPasswordRecord(password: string, record: string | undefined, label: string) {
  if (!record) throw new Error(`网站尚未设置${label}，请联系管理员。`);
  const [algorithm, iterationsText, saltText, expectedText] = record.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expectedText) throw new Error(`${label}配置格式无效。`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(saltText), iterations }, key, 256));
  return constantTimeEqual(actual, base64UrlToBytes(expectedText));
}

export function verifyPassword(password: string) {
  return verifyPasswordRecord(password, process.env.TEAM_PASSWORD_HASH, '团队密码');
}

export async function authenticateMember(member: string, password: string): Promise<SessionRole | null> {
  const { members, paperOwner } = await import('@/lib/config').then(({ teamConfig }) => teamConfig());
  if (!members.includes(member)) return null;
  const role: SessionRole = member === paperOwner ? 'admin' : 'member';
  const record = role === 'admin' ? process.env.ADMIN_PASSWORD_HASH : process.env.TEAM_PASSWORD_HASH;
  return await verifyPasswordRecord(password, record, role === 'admin' ? '管理员密码' : '团队密码') ? role : null;
}

export async function createSessionCookie(identity: { member: string; role: SessionRole }) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('网站会话密钥尚未正确配置。');
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ member: identity.member, role: identity.role, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = bytesToBase64Url(await hmac(payload, secret));
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getSession(request: Request): Promise<Session | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const cookies = request.headers.get('cookie') ?? '';
  const raw = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  try {
    const expected = await hmac(payload, secret);
    if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return null;
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as Partial<Session>;
    if (typeof decoded.member !== 'string' || (decoded.role !== 'admin' && decoded.role !== 'member') || typeof decoded.exp !== 'number' || decoded.exp <= Date.now() / 1000) return null;
    const { members, paperOwner } = await import('@/lib/config').then(({ teamConfig }) => teamConfig());
    const expectedRole: SessionRole = decoded.member === paperOwner ? 'admin' : 'member';
    if (!members.includes(decoded.member) || decoded.role !== expectedRole) return null;
    return { member: decoded.member, role: decoded.role, exp: decoded.exp };
  } catch { return null; }
}

export async function hasValidSession(request: Request) {
  if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') return true;
  return Boolean(await getSession(request));
}

export async function requireSession(request: Request) {
  if (!(await hasValidSession(request))) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401 });
  return null;
}
