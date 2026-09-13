import { beforeEach, describe, expect, it } from 'vitest';
import app from '../worker/index';
import { sha256 } from '../worker/auth';
import type { Bindings } from '../worker/env';
import { InMemoryD1 } from './helpers/in-memory-d1';

describe('Player Directory routes', () => {
  let database: InMemoryD1; let env: Bindings; const token = 'test-session-token';
  beforeEach(async () => {
    database = new InMemoryD1(); const tokenHash = await sha256(token);
    database.sessions.set(tokenHash, { token_hash: tokenHash, password_version: '1', created_at: 1, last_used_at: 1, revoked_at: null });
    env = { DB: database.asDatabase(), PASSWORD_VERSION: '1', SHARED_PASSWORD_HASH: 'unused', SESSION_COOKIE_SECURE: 'false', YOUTUBE_MODE: 'fake', YOUTUBE_AUDIT_APPROVED: 'false' } as Bindings;
  });
  const call = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { cookie: `badminton_session=${token}`, ...init.headers } }, env);

  it('provides authenticated create, sorted list, rename, merge, and removal', async () => {
    const add = (displayName: string) => call('/api/players', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName }) });
    const zoe = await add('  Zoe  '); const alice = await add('Alice');
    expect(zoe.status).toBe(201); expect((await zoe.json() as { displayName: string }).displayName).toBe('Zoe');
    const duplicate = await add(' ＡLICE '); expect(duplicate.status).toBe(409);
    const list = await call('/api/players'); expect((await list.json() as { players: { displayName: string }[] }).players.map((entry) => entry.displayName)).toEqual(['Alice', 'Zoe']);
    const alicePlayer = await alice.json() as { id: string }; const zoePlayer = await (await call('/api/players')).json() as { players: { id: string; displayName: string }[] };
    const zoeId = zoePlayer.players.find((entry) => entry.displayName === 'Zoe')!.id;
    expect((await call(`/api/players/${alicePlayer.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'Alicia' }) })).status).toBe(200);
    expect((await call(`/api/players/${zoeId}/merge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetPlayerId: alicePlayer.id }) })).status).toBe(200);
    expect((await call(`/api/players/${alicePlayer.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`/api/players/${alicePlayer.id}`, { method: 'DELETE' })).status).toBe(404);
  });
});
