import type { ChunkResult, PublisherMetadata, YouTubePublisher } from './publisher';

export class FakeYouTubePublisher implements YouTubePublisher {
  private readonly offsets = new Map<string, number>();
  private sequence = 0;

  async create(_metadata: PublisherMetadata): Promise<string> {
    this.sequence += 1;
    const uploadUrl = `fake://upload/${this.sequence}`;
    this.offsets.set(uploadUrl, 0);
    return uploadUrl;
  }

  async offset(uploadUrl: string, uploadLength: number) {
    const nextOffset = this.offsets.get(uploadUrl) ?? 0;
    return nextOffset === uploadLength
      ? { nextOffset, videoId: `fake-video-${uploadUrl.split('/').at(-1)}` }
      : { nextOffset };
  }

  async upload(
    uploadUrl: string,
    bytes: ArrayBuffer,
    start: number,
    uploadLength: number,
  ): Promise<ChunkResult> {
    const current = this.offsets.get(uploadUrl) ?? 0;
    if (start !== current) return { complete: false, nextOffset: current };
    const nextOffset = start + bytes.byteLength;
    this.offsets.set(uploadUrl, nextOffset);
    return nextOffset === uploadLength
      ? { complete: true, nextOffset, videoId: `fake-video-${this.sequence}` }
      : { complete: false, nextOffset };
  }

  async addToDestinationPlaylist(_videoId: string): Promise<void> {}
}
