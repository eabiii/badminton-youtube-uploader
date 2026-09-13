import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveYouTubePublisher } from '../worker/upload/youtube-publisher';
import type { Bindings } from '../worker/env';

const metadata = {
  fileName: 'game.mp4',
  fileSize: 3,
  mimeType: 'video/mp4' as const,
  matchType: 'Singles Match' as const,
  players: ['Alice', 'Bob'],
  titleNames: ['Alice', 'Bob'],
  matchDate: '2026-09-07',
  title: 'Alice vs Bob | Singles Match | September 7, 2026',
  description: '',
  requestedVisibility: 'Public' as const,
  effectiveVisibility: 'Private' as const,
};

describe('live YouTube publisher adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps OAuth on the backend and authenticates every resumable request', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        requests.push({ url, init });
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({ access_token: 'short-lived-access-token' });
        }
        if (url.includes('uploadType=resumable') && init?.method === 'POST') {
          return new Response(null, {
            status: 200,
            headers: { location: 'https://upload.example/session' },
          });
        }
        if (
          url === 'https://upload.example/session' &&
          init?.headers &&
          new Headers(init.headers).get('content-range')?.startsWith('bytes */')
        ) {
          return new Response(null, { status: 308, headers: { range: 'bytes=0-1' } });
        }
        if (url === 'https://upload.example/session')
          return Response.json({ id: 'video-1' }, { status: 201 });
        if (url.includes('/playlistItems?') && init?.method !== 'POST')
          return Response.json({ items: [] });
        if (url.includes('/playlistItems?') && init?.method === 'POST')
          return Response.json({ id: 'item-1' });
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    const publisher = new LiveYouTubePublisher({
      YOUTUBE_CLIENT_ID: 'client-id',
      YOUTUBE_CLIENT_SECRET: 'client-secret',
      YOUTUBE_REFRESH_TOKEN: 'refresh-token',
      YOUTUBE_PLAYLIST_ID: 'playlist-id',
    } as Bindings);

    const uploadUrl = await publisher.create(metadata);
    await expect(publisher.offset(uploadUrl, 3)).resolves.toEqual({ nextOffset: 2 });
    await expect(publisher.upload(uploadUrl, new Uint8Array([3]).buffer, 2, 3)).resolves.toEqual({
      complete: true,
      nextOffset: 3,
      videoId: 'video-1',
    });
    await publisher.addToDestinationPlaylist('video-1');

    const resumableRequests = requests.filter((request) => request.url === uploadUrl);
    expect(resumableRequests).toHaveLength(2);
    for (const request of resumableRequests) {
      expect(new Headers(request.init?.headers).get('authorization')).toBe(
        'Bearer short-lived-access-token',
      );
    }
    const createBody = JSON.parse(
      String(requests.find((request) => request.url.includes('uploadType=resumable'))?.init?.body),
    );
    expect(createBody).toMatchObject({
      snippet: { categoryId: '17' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    });
  });
});
