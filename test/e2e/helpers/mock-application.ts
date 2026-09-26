import type { BrowserContext, Page, Route } from '@playwright/test';
import type { UploadView } from '../../../shared/domain';

export const uploadView: UploadView = {
  leaseId: 'lease-1',
  state: 'uploading',
  uploadedBytes: 0,
  uploadLength: 3,
  requestedVisibility: 'Unlisted',
  effectiveVisibility: 'Private',
};

export type ChunkOutcome = 'pending' | 'success' | 'partial' | 'failure';

export type MockOptions = {
  authenticated?: boolean;
  auditApproved?: boolean;
  status?: object | (() => object);
  chunkOutcomes?: ChunkOutcome[];
  players?: { id: string; displayName: string }[];
  queuingEntries?: { id: string; name: string; location: string }[];
  cancelStatus?: number;
  heartbeatStatus?: number;
  loginStatus?: number;
  playerFailure?: { method: string; status: number; message: string };
  queuingFailure?: { method: string; status: number; message: string };
};

export type MockState = {
  authenticated: boolean;
  acceptedPartialSuccess: number;
  cancelled: number;
  chunkOffsets: string[];
  heartbeats: number;
  loginAttempts: number;
  logoutAttempts: number;
  playlistRetries: number;
  starts: Record<string, unknown>[];
};

const completedView = (partial: boolean, base: UploadView = uploadView): UploadView => ({
  ...base,
  state: partial ? 'partial_success' : 'uploading',
  uploadedBytes: 3,
  videoId: 'video-1',
  watchUrl: 'https://www.youtube.com/watch?v=video-1',
  studioUrl: 'https://studio.youtube.com/video/video-1/edit',
});

async function jsonBody(route: Route): Promise<Record<string, unknown>> {
  return (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
}

export async function mockApplication(context: BrowserContext, options: MockOptions = {}) {
  const players = options.players ?? [
    { id: 'a', displayName: 'Alice' },
    { id: 'b', displayName: 'Bob' },
    { id: 'c', displayName: 'Carla' },
    { id: 'd', displayName: 'Dinesh' },
  ];
  const outcomes = [...(options.chunkOutcomes ?? ['pending'])];
  const queuingEntries = options.queuingEntries ?? [
    { id: 'q1', name: 'GOODSHOTS!', location: 'Gameville Central Park' },
    { id: 'q2', name: 'Friday Club', location: 'Riverside Hall' },
  ];
  const state: MockState = {
    authenticated: options.authenticated ?? true,
    acceptedPartialSuccess: 0,
    cancelled: 0,
    chunkOffsets: [],
    heartbeats: 0,
    loginAttempts: 0,
    logoutAttempts: 0,
    playlistRetries: 0,
    starts: [],
  };
  let activeView: UploadView = uploadView;

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/api/session') {
      if (!state.authenticated)
        return route.fulfill({ status: 401, json: { error: 'Authentication required.' } });
      return route.fulfill({
        json: {
          authenticated: true,
          auditApproved: options.auditApproved ?? false,
          publisherMode: 'fake',
        },
      });
    }
    if (path === '/api/login') {
      state.loginAttempts += 1;
      if (options.loginStatus && options.loginStatus !== 200)
        return route.fulfill({
          status: options.loginStatus,
          headers: options.loginStatus === 429 ? { 'Retry-After': '60' } : undefined,
          json: {
            error:
              options.loginStatus === 429
                ? 'Too many failed sign-in attempts. Try again later.'
                : 'The shared password is incorrect.',
          },
        });
      state.authenticated = true;
      return route.fulfill({ json: { authenticated: true } });
    }
    if (path === '/api/logout') {
      state.logoutAttempts += 1;
      state.authenticated = false;
      return route.fulfill({ json: { authenticated: false } });
    }
    if (path === '/api/upload/status') {
      const status = typeof options.status === 'function' ? options.status() : options.status;
      return route.fulfill({ json: status ?? { busy: false } });
    }
    if (path === '/api/players' && method === 'GET') return route.fulfill({ json: { players } });
    if (path === '/api/queuing-entries' && method === 'GET')
      return route.fulfill({ json: { queuingEntries } });
    if (options.playerFailure?.method === method && path.startsWith('/api/players'))
      return route.fulfill({
        status: options.playerFailure.status,
        json: { error: options.playerFailure.message },
      });
    if (path === '/api/players' && method === 'POST') {
      const body = await jsonBody(route);
      const created = { id: `player-${players.length + 1}`, displayName: String(body.displayName) };
      players.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    const playerMatch = path.match(/^\/api\/players\/([^/]+)$/);
    if (playerMatch && method === 'PATCH') {
      const player = players.find((entry) => entry.id === playerMatch[1]);
      const body = await jsonBody(route);
      if (!player) return route.fulfill({ status: 404, json: { error: 'Player not found.' } });
      player.displayName = String(body.displayName);
      return route.fulfill({ json: player });
    }
    const mergeMatch = path.match(/^\/api\/players\/([^/]+)\/merge$/);
    if (mergeMatch && method === 'POST') {
      const body = await jsonBody(route);
      const target = players.find((entry) => entry.id === body.targetPlayerId);
      const sourceIndex = players.findIndex((entry) => entry.id === mergeMatch[1]);
      if (!target) return route.fulfill({ status: 404, json: { error: 'Player not found.' } });
      if (sourceIndex >= 0) players.splice(sourceIndex, 1);
      return route.fulfill({ json: target });
    }
    if (playerMatch && method === 'DELETE') {
      const index = players.findIndex((entry) => entry.id === playerMatch[1]);
      if (index >= 0) players.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    if (options.queuingFailure?.method === method && path.startsWith('/api/queuing-entries'))
      return route.fulfill({
        status: options.queuingFailure.status,
        json: { error: options.queuingFailure.message },
      });
    if (path === '/api/queuing-entries' && method === 'POST') {
      const body = await jsonBody(route);
      const created = {
        id: `queue-${queuingEntries.length + 1}`,
        name: String(body.name),
        location: String(body.location),
      };
      queuingEntries.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    const queuingMatch = path.match(/^\/api\/queuing-entries\/([^/]+)$/);
    if (queuingMatch && method === 'PATCH') {
      const entry = queuingEntries.find((candidate) => candidate.id === queuingMatch[1]);
      const body = await jsonBody(route);
      if (!entry)
        return route.fulfill({ status: 404, json: { error: 'Queuing entry not found.' } });
      entry.name = String(body.name);
      entry.location = String(body.location);
      return route.fulfill({ json: entry });
    }
    if (queuingMatch && method === 'DELETE') {
      const index = queuingEntries.findIndex((entry) => entry.id === queuingMatch[1]);
      if (index < 0)
        return route.fulfill({ status: 404, json: { error: 'Queuing entry not found.' } });
      queuingEntries.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/upload/start') {
      const body = await jsonBody(route);
      state.starts.push(body);
      const requestedVisibility = String(body.requestedVisibility) as
        'Private' | 'Unlisted' | 'Public';
      activeView = {
        ...uploadView,
        requestedVisibility,
        effectiveVisibility: options.auditApproved ? requestedVisibility : 'Private',
      };
      return route.fulfill({ status: 201, json: activeView });
    }
    if (path.endsWith('/chunk')) {
      state.chunkOffsets.push(request.headers()['x-upload-offset'] ?? '');
      const outcome = outcomes.shift() ?? outcomes.at(-1) ?? 'success';
      if (outcome === 'pending') {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        return route.fulfill({ json: { complete: false, nextOffset: 0 } });
      }
      if (outcome === 'failure')
        return route.fulfill({ status: 502, json: { error: 'The network connection was lost.' } });
      return route.fulfill({
        json: {
          complete: true,
          nextOffset: 3,
          upload: completedView(outcome === 'partial', activeView),
        },
      });
    }
    if (path.endsWith('/heartbeat')) {
      state.heartbeats += 1;
      if (options.heartbeatStatus && options.heartbeatStatus !== 204)
        return route.fulfill({
          status: options.heartbeatStatus,
          json: { error: 'The upload heartbeat failed.' },
        });
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/cancel')) {
      state.cancelled += 1;
      if (options.cancelStatus && options.cancelStatus !== 204)
        return route.fulfill({
          status: options.cancelStatus,
          json: {
            error:
              options.cancelStatus === 410
                ? 'The upload lease expired. Restart from byte zero.'
                : 'Could not release the Game Upload.',
          },
        });
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/retry-playlist')) {
      state.playlistRetries += 1;
      return route.fulfill({ json: completedView(false, activeView) });
    }
    if (path.endsWith('/accept-partial-success')) {
      state.acceptedPartialSuccess += 1;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 204 });
  });
  return state;
}

export async function selectPlayer(page: Page, label: string, name: string) {
  const input = page.getByRole('combobox', { name: label });
  await input.click();
  await input.fill(name);
  await page.getByRole('option', { name, exact: true }).click();
}

export async function selectQueuingEntry(page: Page, text: string) {
  const input = page.getByRole('combobox', { name: 'Queuing Session' });
  await input.click();
  await input.fill(text);
  await page.getByRole('option', { name: text, exact: true }).click();
}

export async function fillRequiredGame(page: Page) {
  await page.getByLabel('Match Type').selectOption('Singles Match');
  await page.getByLabel('Match Date').fill('2026-09-07');
  await selectPlayer(page, 'Player 1', 'Alice');
  await selectPlayer(page, 'Player 2', 'Bob');
  await page
    .getByLabel(/Choose one MP4/)
    .setInputFiles({ name: 'game.mp4', mimeType: 'video/mp4', buffer: Buffer.from('abc') });
}
