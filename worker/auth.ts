import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context, MiddlewareHandler } from 'hono';
import type { Bindings } from './env';
import { SESSION_COOKIE_MAX_AGE_SECONDS } from '../shared/domain';

const COOKIE_NAME = 'badminton_session';
type AuthEnv = { Bindings: Bindings; Variables: { sessionHash: string } };

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encodeBase64(new Uint8Array(digest));
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (typeof encoded !== 'string') return false;
  const [algorithm, iterationText, saltText, expectedText] = encoded.split(':');
  const iterations = Number(iterationText);
  if (algorithm !== 'pbkdf2-sha256' || iterations !== 100_000) return false;

  let saltBytes: Uint8Array;
  let expected: Uint8Array;
  try {
    saltBytes = decodeBase64(saltText);
    expected = decodeBase64(expectedText);
  } catch {
    return false;
  }
  const salt = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      expected.length * 8,
    ),
  );
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1)
    difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function cookieOptions(context: Context<AuthEnv>) {
  return {
    httpOnly: true,
    sameSite: 'Strict' as const,
    secure: context.env.SESSION_COOKIE_SECURE !== 'false',
    path: '/',
    // Browsers cap persistent cookies, so authenticated use rolls this 400-day maximum forward.
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function createSession(context: Context<AuthEnv>): Promise<void> {
  const token = encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = Date.now();
  await context.env.DB.prepare(
    'INSERT INTO sessions (token_hash, password_version, created_at, last_used_at) VALUES (?, ?, ?, ?)',
  )
    .bind(tokenHash, context.env.PASSWORD_VERSION, now, now)
    .run();
  setCookie(context, COOKIE_NAME, token, cookieOptions(context));
}

export async function revokeSession(context: Context<AuthEnv>): Promise<void> {
  const token = getCookie(context, COOKIE_NAME);
  if (token) {
    await context.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(Date.now(), await sha256(token))
      .run();
  }
  deleteCookie(context, COOKIE_NAME, { path: '/', secure: cookieOptions(context).secure });
}

export const requireSession: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: { sessionHash: string };
}> = async (context, next) => {
  const token = getCookie(context, COOKIE_NAME);
  if (!token) return context.json({ error: 'Authentication required.' }, 401);
  const sessionHash = await sha256(token);
  const session = await context.env.DB.prepare(
    'SELECT token_hash FROM sessions WHERE token_hash = ? AND password_version = ? AND revoked_at IS NULL',
  )
    .bind(sessionHash, context.env.PASSWORD_VERSION)
    .first();
  if (!session) return context.json({ error: 'Authentication required.' }, 401);
  await context.env.DB.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?')
    .bind(Date.now(), sessionHash)
    .run();
  setCookie(context, COOKIE_NAME, token, cookieOptions(context));
  context.set('sessionHash', sessionHash);
  await next();
};
