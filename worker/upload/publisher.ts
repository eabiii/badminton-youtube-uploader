import type { GameUploadMetadata, Visibility } from '../../shared/domain';

export type PublisherMetadata = GameUploadMetadata & { effectiveVisibility: Visibility };

export type ChunkResult =
  | { complete: false; nextOffset: number }
  | { complete: true; nextOffset: number; videoId: string };

export type OffsetResult = { nextOffset: number; videoId?: string };

export interface YouTubePublisher {
  create(metadata: PublisherMetadata): Promise<string>;
  offset(uploadUrl: string, uploadLength: number): Promise<OffsetResult>;
  upload(uploadUrl: string, bytes: ArrayBuffer, start: number, uploadLength: number): Promise<ChunkResult>;
  addToDestinationPlaylist(videoId: string): Promise<void>;
}

export function videoLinks(videoId: string) {
  return {
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    studioUrl: `https://studio.youtube.com/video/${encodeURIComponent(videoId)}/edit`,
  };
}
