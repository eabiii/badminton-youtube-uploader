import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../worker/auth';
import app from '../worker/index';
import type { Bindings } from '../worker/env';
import { InMemoryD1 } from './helpers/in-memory-d1';

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
async function passwordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256));
  return `pbkdf2-sha256:100000:${base64(salt)}:${base64(hash)}`;
}
async function environment(database: InMemoryD1, version = '1') {
  return { DB: database.asDatabase(), SHARED_PASSWORD_HASH: await passwordHash('correct horse'), PASSWORD_VERSION: version,
    SESSION_COOKIE_SECURE: 'false', YOUTUBE_MODE: 'fake', YOUTUBE_AUDIT_APPROVED: 'false' } as Bindings;
}
const cookieFrom = (response: Response) => response.headers.get('set-cookie')?.split(';')[0] ?? '';

describe('shared-password authentication', () => {
  it('verifies a PBKDF2-SHA256 deployment hash', async () => {
    const encoded = await passwordHash('a useful shared password');
    await expect(verifyPassword('a useful shared password', encoded)).resolves.toBe(true);
    await expect(verifyPassword('incorrect', encoded)).resolves.toBe(false);
  });

  it('creates and rolls a persistent 400-day session cookie', async () => {
    const database = new InMemoryD1(); const env = await environment(database);
    const login = await app.request('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse' }) }, env);
    expect(login.status).toBe(200); expect(login.headers.get('set-cookie')).toContain('Max-Age=34560000');
    const session = await app.request('/api/session', { headers: { cookie: cookieFrom(login) } }, env);
    expect(session.status).toBe(200); expect(session.headers.get('set-cookie')).toContain('Max-Age=34560000');
  });

  it('revokes logout and invalidates sessions after a password-version change', async () => {
    const database = new InMemoryD1(); const env = await environment(database);
    const login = await app.request('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse' }) }, env);
    const cookie = cookieFrom(login);
    expect((await app.request('/api/session', { headers: { cookie } }, { ...env, PASSWORD_VERSION: '2' })).status).toBe(401);
    expect((await app.request('/api/logout', { method: 'POST', headers: { cookie } }, env)).status).toBe(200);
    expect((await app.request('/api/session', { headers: { cookie } }, env)).status).toBe(401);
  });

  it('limits a hashed client bucket after five failures and resets it after success', async () => {
    const database = new InMemoryD1(); const env = await environment(database);
    const request = (password: string) => app.request('/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' }, body: JSON.stringify({ password }) }, env);
    for (let count = 0; count < 4; count += 1) expect((await request('wrong')).status).toBe(401);
    expect((await request('correct horse')).status).toBe(200);
    for (let count = 0; count < 5; count += 1) expect((await request('wrong')).status).toBe(401);
    const blocked = await request('wrong'); expect(blocked.status).toBe(429); expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect([...database.attempts.keys()][0]).not.toContain('203.0.113.5');
  });
});
