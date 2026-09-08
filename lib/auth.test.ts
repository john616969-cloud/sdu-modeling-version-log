import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import { authenticateMember, clearSessionCookie, createSessionCookie, getSession, hasValidSession, SESSION_SECONDS, verifyPassword } from '@/lib/auth';

const secret = 'test-session-secret-that-is-longer-than-32-characters';

describe('seven-day session', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = secret;
    process.env.TEAM_MEMBERS = '张怡慧,陈鑫,谷雨蔓';
    process.env.PAPER_OWNER = '张怡慧';
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.TEAM_MEMBERS;
    delete process.env.PAPER_OWNER;
  });

  it('creates a secure cookie valid for seven days', async () => {
    const before = Math.floor(Date.now() / 1000);
    const cookie = await createSessionCookie({ member: '张怡慧', role: 'admin' });
    const token = cookie.match(/^modeling_session=([^;]+)/)?.[1];
    expect(SESSION_SECONDS).toBe(604800);
    expect(cookie).toContain('Max-Age=604800');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(token).toBeTruthy();
    const payload = token!.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { member: string; role: string; exp: number };
    expect(parsed.member).toBe('张怡慧');
    expect(parsed.role).toBe('admin');
    expect(parsed.exp).toBeGreaterThanOrEqual(before + SESSION_SECONDS);
    expect(parsed.exp).toBeLessThanOrEqual(before + SESSION_SECONDS + 1);
  });

  it('accepts a valid cookie and rejects a damaged one', async () => {
    const cookie = await createSessionCookie({ member: '陈鑫', role: 'member' });
    const pair = cookie.split(';')[0];
    expect(await hasValidSession(new Request('https://example.test', { headers: { cookie: pair } }))).toBe(true);
    expect((await getSession(new Request('https://example.test', { headers: { cookie: pair } })))?.member).toBe('陈鑫');
    expect(await hasValidSession(new Request('https://example.test', { headers: { cookie: `${pair}x` } }))).toBe(false);
  });

  it('clears the remembered session on logout', () => {
    expect(clearSessionCookie()).toContain('Max-Age=0');
  });
});

describe('team password', () => {
  afterEach(() => {
    delete process.env.TEAM_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.TEAM_MEMBERS;
    delete process.env.PAPER_OWNER;
  });

  it('verifies a Workers-compatible 100,000-round PBKDF2 record', async () => {
    const salt = Buffer.from('fixed-test-salt');
    const hash = pbkdf2Sync('test-password', salt, 100000, 32, 'sha256');
    process.env.TEAM_PASSWORD_HASH = `pbkdf2$100000$${salt.toString('base64url')}$${hash.toString('base64url')}`;
    expect(await verifyPassword('test-password')).toBe(true);
    expect(await verifyPassword('wrong-password')).toBe(false);
  });

  it('uses an independent administrator password for the paper owner', async () => {
    const salt = Buffer.from('fixed-test-salt');
    const teamHash = pbkdf2Sync('team-password', salt, 100000, 32, 'sha256');
    const adminHash = pbkdf2Sync('admin-password', salt, 100000, 32, 'sha256');
    process.env.TEAM_PASSWORD_HASH = `pbkdf2$100000$${salt.toString('base64url')}$${teamHash.toString('base64url')}`;
    process.env.ADMIN_PASSWORD_HASH = `pbkdf2$100000$${salt.toString('base64url')}$${adminHash.toString('base64url')}`;
    process.env.TEAM_MEMBERS = '张怡慧,陈鑫,谷雨蔓';
    process.env.PAPER_OWNER = '张怡慧';

    expect(await authenticateMember('张怡慧', 'admin-password')).toBe('admin');
    expect(await authenticateMember('张怡慧', 'team-password')).toBeNull();
    expect(await authenticateMember('陈鑫', 'team-password')).toBe('member');
    expect(await authenticateMember('不存在', 'team-password')).toBeNull();
  });
});
