import type { Bindings } from '../env';
import type { ChunkResult, PublisherMetadata, YouTubePublisher } from './publisher';

export class LiveYouTubePublisher implements YouTubePublisher {
  constructor(private readonly env: Bindings) {}

  private requireConfiguration(): Required<
    Pick<
      Bindings,
      | 'YOUTUBE_CLIENT_ID'
      | 'YOUTUBE_CLIENT_SECRET'
      | 'YOUTUBE_REFRESH_TOKEN'
      | 'YOUTUBE_PLAYLIST_ID'
    >
  > {
    const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, YOUTUBE_PLAYLIST_ID } =
      this.env;
    if (
      !YOUTUBE_CLIENT_ID ||
      !YOUTUBE_CLIENT_SECRET ||
      !YOUTUBE_REFRESH_TOKEN ||
      !YOUTUBE_PLAYLIST_ID
    ) {
      throw new Error('Live YouTube publishing is not configured.');
    }
    return { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, YOUTUBE_PLAYLIST_ID };
  }

  private async accessToken(): Promise<string> {
    const config = this.requireConfiguration();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.YOUTUBE_CLIENT_ID,
        client_secret: config.YOUTUBE_CLIENT_SECRET,
        refresh_token: config.YOUTUBE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new Error(`YouTube authorization refresh failed (${response.status}).`);
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token)
      throw new Error('YouTube authorization refresh returned no access token.');
    return body.access_token;
  }

  async create(metadata: PublisherMetadata): Promise<string> {
    const token = await this.accessToken();
    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-length': String(metadata.fileSize),
          'x-upload-content-type': metadata.mimeType,
        },
        body: JSON.stringify({
          snippet: { title: metadata.title, description: metadata.description, categoryId: '17' },
          status: {
            privacyStatus: metadata.effectiveVisibility.toLowerCase(),
            selfDeclaredMadeForKids: false,
          },
        }),
      },
    );
    const uploadUrl = response.headers.get('location');
    if (!response.ok || !uploadUrl)
      throw new Error(`YouTube did not create an upload session (${response.status}).`);
    return uploadUrl;
  }

  async offset(uploadUrl: string, uploadLength: number) {
    const token = await this.accessToken();
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-length': '0',
        'content-range': `bytes */${uploadLength}`,
      },
    });
    if (response.status === 308) {
      const range = response.headers.get('range');
      return { nextOffset: range ? Number(range.match(/\d+$/)?.[0]) + 1 : 0 };
    }
    if (response.ok) {
      const body = (await response.json()) as { id?: string };
      if (!body.id) throw new Error('YouTube completed the upload without returning a video ID.');
      return { nextOffset: uploadLength, videoId: body.id };
    }
    throw new Error(`YouTube offset reconciliation failed (${response.status}).`);
  }

  async upload(
    uploadUrl: string,
    bytes: ArrayBuffer,
    start: number,
    uploadLength: number,
  ): Promise<ChunkResult> {
    const token = await this.accessToken();
    const end = start + bytes.byteLength - 1;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-length': String(bytes.byteLength),
        'content-type': 'video/mp4',
        'content-range': `bytes ${start}-${end}/${uploadLength}`,
      },
      body: bytes,
    });
    if (response.status === 308) {
      const range = response.headers.get('range');
      return { complete: false, nextOffset: range ? Number(range.match(/\d+$/)?.[0]) + 1 : 0 };
    }
    if (!response.ok) throw new Error(`YouTube chunk upload failed (${response.status}).`);
    const body = (await response.json()) as { id?: string };
    if (!body.id) throw new Error('YouTube completed the upload without returning a video ID.');
    return { complete: true, nextOffset: uploadLength, videoId: body.id };
  }

  async addToDestinationPlaylist(videoId: string): Promise<void> {
    const config = this.requireConfiguration();
    const token = await this.accessToken();
    const lookup = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    lookup.search = new URLSearchParams({
      part: 'id',
      playlistId: config.YOUTUBE_PLAYLIST_ID,
      videoId,
      maxResults: '1',
    }).toString();
    const existingResponse = await fetch(lookup, { headers: { authorization: `Bearer ${token}` } });
    if (!existingResponse.ok)
      throw new Error(`Destination Playlist lookup failed (${existingResponse.status}).`);
    const existing = (await existingResponse.json()) as { items?: unknown[] };
    if (existing.items?.length) return;
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          snippet: {
            playlistId: config.YOUTUBE_PLAYLIST_ID,
            resourceId: { kind: 'youtube#video', videoId },
          },
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Destination Playlist insertion failed (${response.status}).`);
  }
}
