const COOKIE_NAME = 'modeling_session';
const SESSION_SECONDS = 12 * 60 * 60;

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

export async function verifyPassword(password: string) {
  const record = process.env.TEAM_PASSWORD_HASH;
  if (!record) throw new Error('网站尚未设置团队密码，请联系管理员。');
  const [algorithm, iterationsText, saltText, expectedText] = record.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expectedText) throw new Error('团队密码配置格式无效。');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(saltText), iterations }, key, 256));
  return constantTimeEqual(actual, base64UrlToBytes(expectedText));
}

export async function createSessionCookie() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('网站会话密钥尚未正确配置。');
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = bytesToBase64Url(await hmac(payload, secret));
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function hasValidSession(request: Request) {
  if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') return true;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookies = request.headers.get('cookie') ?? '';
  const raw = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return false;
  try {
    const expected = await hmac(payload, secret);
    if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return false;
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { exp?: number };
    return typeof decoded.exp === 'number' && decoded.exp > Date.now() / 1000;
  } catch { return false; }
}

export async function requireSession(request: Request) {
  if (!(await hasValidSession(request))) return Response.json({ error: '登录已失效，请重新登录。' }, { status: 401 });
  return null;
}
