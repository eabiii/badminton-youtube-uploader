import { beforeEach, describe, expect, it } from 'vitest';
import app from '../worker/index';
import { sha256 } from '../worker/auth';
import type { Bindings } from '../worker/env';
import { InMemoryD1 } from './helpers/in-memory-d1';

describe('Queuing Directory routes', () => {
  let database: InMemoryD1;
  let env: Bindings;
  const token = 'test-session-token';

  beforeEach(async () => {
    database = new InMemoryD1();
    const tokenHash = await sha256(token);
    database.sessions.set(tokenHash, {
      token_hash: tokenHash,
      password_version: '1',
      created_at: 1,
      last_used_at: 1,
      revoked_at: null,
    });
    env = {
      DB: database.asDatabase(),
      PASSWORD_VERSION: '1',
      SHARED_PASSWORD_HASH: 'unused',
      SESSION_COOKIE_SECURE: 'false',
      YOUTUBE_MODE: 'fake',
      YOUTUBE_AUDIT_APPROVED: 'false',
    } as Bindings;
  });

  const call = (path: string, init: RequestInit = {}) =>
    app.request(
      path,
      { ...init, headers: { cookie: `badminton_session=${token}`, ...init.headers } },
      env,
    );
  const mutation = (path: string, method: 'POST' | 'PATCH', body: object) =>
    call(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('creates, lists, updates, and removes entries with useful API errors', async () => {
    const first = await mutation('/api/queuing-entries', 'POST', {
      name: ' GOODSHOTS! ',
      location: ' Central Park ',
    });
    expect(first.status).toBe(201);
    const created = (await first.json()) as { id: string; name: string; location: string };
    expect(created).toMatchObject({ name: 'GOODSHOTS!', location: 'Central Park' });
    expect(
      (
        await mutation('/api/queuing-entries', 'POST', {
          name: 'goodshots!',
          location: 'central park',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await mutation('/api/queuing-entries', 'POST', {
          name: '',
          location: 'Central Park',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await mutation(`/api/queuing-entries/${created.id}`, 'PATCH', {
          name: 'GOODSHOTS! Friday',
          location: 'Gameville',
        })
      ).status,
    ).toBe(200);
    const list = (await (await call('/api/queuing-entries')).json()) as {
      queuingEntries: Array<{ name: string; location: string }>;
    };
    expect(list.queuingEntries).toEqual([
      { id: created.id, name: 'GOODSHOTS! Friday', location: 'Gameville' },
    ]);
    expect((await call(`/api/queuing-entries/${created.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await call(`/api/queuing-entries/${created.id}`, { method: 'DELETE' })).status).toBe(
      404,
    );
  });
});
