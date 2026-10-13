import { describe, expect, it } from 'vitest';
import app from '../worker/index';
import type { Bindings } from '../worker/env';
import { InMemoryD1 } from './helpers/in-memory-d1';

const validHash = `pbkdf2-sha256:100000:${Buffer.alloc(16).toString('base64')}:${Buffer.alloc(32).toString('base64')}`;

function environment(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: new InMemoryD1().asDatabase(),
    SHARED_PASSWORD_HASH: validHash,
    PASSWORD_VERSION: '1',
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: '900',
    SESSION_COOKIE_SECURE: 'true',
    YOUTUBE_MODE: 'live',
    YOUTUBE_AUDIT_APPROVED: 'false',
    YOUTUBE_CLIENT_ID: 'client-id',
    YOUTUBE_CLIENT_SECRET: 'client-secret',
    YOUTUBE_REFRESH_TOKEN: 'refresh-token',
    YOUTUBE_PLAYLIST_ID: 'playlist-id',
    ...overrides,
  } as Bindings;
}

describe('health endpoint', () => {
  it('reports healthy configuration and D1 without authentication', async () => {
    const response = await app.request('/api/health', {}, environment());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns a generic response when live publishing configuration is incomplete', async () => {
    const response = await app.request(
      '/api/health',
      {},
      environment({ YOUTUBE_REFRESH_TOKEN: undefined }),
    );

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ status: 'unavailable' });
    expect(body).not.toContain('YOUTUBE_REFRESH_TOKEN');
  });

  it('rejects a password hash above the Cloudflare Workers PBKDF2 limit', async () => {
    const overLimitHash = validHash.replace('pbkdf2-sha256:100000:', 'pbkdf2-sha256:600000:');
    const response = await app.request(
      '/api/health',
      {},
      environment({ SHARED_PASSWORD_HASH: overLimitHash }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
  });

  it.each([undefined, 'not-a-number', '0', '-1', '1.5'])(
    'returns a generic response for invalid login rate-limit window %s',
    async (LOGIN_RATE_LIMIT_WINDOW_SECONDS) => {
      const response = await app.request(
        '/api/health',
        {},
        environment({ LOGIN_RATE_LIMIT_WINDOW_SECONDS }),
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
    },
  );

  it('returns a generic response when D1 is unavailable', async () => {
    const database = {
      prepare() {
        return {
          first: () => Promise.reject(new Error('database-id: do-not-expose')),
        };
      },
    } as unknown as D1Database;
    const response = await app.request('/api/health', {}, environment({ DB: database }));

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toBe('{"status":"unavailable"}');
    expect(body).not.toContain('database-id');
  });
});
