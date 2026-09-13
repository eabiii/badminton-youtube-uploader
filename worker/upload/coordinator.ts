import {
  CHUNK_SIZE,
  LEASE_DURATION_MS,
  gameUploadMetadataSchema,
  effectiveVisibility,
  type GameUploadMetadata,
  type UploadView,
  type Visibility,
} from '../../shared/domain';
import type { LeaseRecord, LeaseRepository } from './lease-repository';
import { videoLinks, type YouTubePublisher } from './publisher';

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410 | 502,
    readonly offset?: number,
  ) {
    super(message);
  }
}

export class UploadCoordinator {
  constructor(
    private readonly leases: LeaseRepository,
    private readonly publisher: YouTubePublisher,
    private readonly auditApproved: boolean,
    private readonly now: () => number = Date.now,
  ) {}

  private view(record: LeaseRecord): UploadView {
    const links = record.videoId ? videoLinks(record.videoId) : {};
    return {
      leaseId: record.leaseId,
      state: record.state,
      uploadedBytes: record.uploadedBytes,
      uploadLength: record.uploadLength,
      requestedVisibility: record.metadata.requestedVisibility,
      effectiveVisibility: record.effectiveVisibility,
      videoId: record.videoId ?? undefined,
      ...links,
    };
  }

  async status(ownerSessionHash: string): Promise<{ busy: boolean; upload?: UploadView }> {
    const active = await this.leases.findActive(this.now());
    if (!active) return { busy: false };
    return active.ownerSessionHash === ownerSessionHash
      ? { busy: true, upload: this.view(active) }
      : { busy: true };
  }

  async start(ownerSessionHash: string, input: unknown): Promise<UploadView> {
    const metadata = gameUploadMetadataSchema.parse(input);
    const uploadVisibility: Visibility = effectiveVisibility(
      metadata.requestedVisibility,
      this.auditApproved,
    );
    const now = this.now();
    const record: LeaseRecord = {
      leaseId: crypto.randomUUID(),
      ownerSessionHash,
      expiresAt: now + LEASE_DURATION_MS,
      state: 'uploading',
      uploadUrl: null,
      uploadLength: metadata.fileSize,
      uploadedBytes: 0,
      videoId: null,
      metadata,
      effectiveVisibility: uploadVisibility,
    };
    if (!(await this.leases.acquire(record, now))) {
      throw new UploadError('Another Game Upload is active.', 409);
    }

    try {
      const uploadUrl = await this.publisher.create({
        ...metadata,
        effectiveVisibility: uploadVisibility,
      });
      await this.leases.attachUploadUrl(record.leaseId, ownerSessionHash, uploadUrl);
      return this.view({ ...record, uploadUrl });
    } catch (error) {
      await this.leases.release(record.leaseId, ownerSessionHash);
      throw error;
    }
  }

  async heartbeat(ownerSessionHash: string, leaseId: string): Promise<void> {
    if (!(await this.leases.renew(leaseId, ownerSessionHash, this.now()))) {
      throw new UploadError('The upload lease expired. Restart from byte zero.', 410);
    }
  }

  private async owned(ownerSessionHash: string, leaseId: string): Promise<LeaseRecord> {
    const active = await this.leases.findActive(this.now());
    if (!active || active.leaseId !== leaseId) {
      throw new UploadError('The upload lease expired. Restart from byte zero.', 410);
    }
    if (active.ownerSessionHash !== ownerSessionHash)
      throw new UploadError('This upload belongs to another session.', 403);
    return active;
  }

  async uploadChunk(
    ownerSessionHash: string,
    leaseId: string,
    start: number,
    bytes: ArrayBuffer,
  ): Promise<{ complete: boolean; upload?: UploadView; nextOffset: number }> {
    const active = await this.owned(ownerSessionHash, leaseId);
    if (active.state !== 'uploading' || !active.uploadUrl)
      throw new UploadError('The Game Upload cannot accept chunks.', 409);
    const isFinal = start + bytes.byteLength === active.uploadLength;
    if (
      bytes.byteLength <= 0 ||
      bytes.byteLength > CHUNK_SIZE ||
      (!isFinal && bytes.byteLength !== CHUNK_SIZE)
    ) {
      throw new UploadError('Chunks must be 64 MiB except for the final chunk.', 400);
    }
    const reconciliation = await this.publisher.offset(active.uploadUrl, active.uploadLength);
    if (reconciliation.videoId) {
      return this.completeUpload(active, reconciliation.videoId, reconciliation.nextOffset);
    }
    if (start !== reconciliation.nextOffset) {
      await this.leases.updateProgress(
        leaseId,
        ownerSessionHash,
        reconciliation.nextOffset,
        this.now(),
      );
      throw new UploadError(
        'Chunk offset does not match YouTube; resume at the returned offset.',
        409,
        reconciliation.nextOffset,
      );
    }
    const result = await this.publisher.upload(active.uploadUrl, bytes, start, active.uploadLength);
    await this.leases.updateProgress(leaseId, ownerSessionHash, result.nextOffset, this.now());
    if (!result.complete) return { complete: false, nextOffset: result.nextOffset };

    return this.completeUpload(active, result.videoId, result.nextOffset);
  }

  private async completeUpload(
    active: LeaseRecord,
    videoId: string,
    nextOffset: number,
  ): Promise<{ complete: true; upload: UploadView; nextOffset: number }> {
    try {
      await this.publisher.addToDestinationPlaylist(videoId);
    } catch {
      await this.leases.markPartialSuccess(
        active.leaseId,
        active.ownerSessionHash,
        videoId,
        this.now(),
      );
      return {
        complete: true,
        nextOffset,
        upload: this.view({
          ...active,
          state: 'partial_success',
          uploadedBytes: nextOffset,
          videoId,
        }),
      };
    }
    await this.leases.release(active.leaseId, active.ownerSessionHash);
    return {
      complete: true,
      nextOffset,
      upload: {
        ...this.view({ ...active, uploadedBytes: nextOffset, videoId }),
        state: 'uploading',
      },
    };
  }

  async retryPlaylist(ownerSessionHash: string, leaseId: string): Promise<UploadView> {
    const active = await this.owned(ownerSessionHash, leaseId);
    if (active.state !== 'partial_success' || !active.videoId)
      throw new UploadError('There is no playlist step to retry.', 409);
    await this.publisher.addToDestinationPlaylist(active.videoId);
    await this.leases.release(leaseId, ownerSessionHash);
    return this.view(active);
  }

  async cancel(ownerSessionHash: string, leaseId: string): Promise<void> {
    await this.owned(ownerSessionHash, leaseId);
    await this.leases.release(leaseId, ownerSessionHash);
  }

  async acceptPartialSuccess(ownerSessionHash: string, leaseId: string): Promise<void> {
    const active = await this.owned(ownerSessionHash, leaseId);
    if (active.state !== 'partial_success')
      throw new UploadError('The Game Upload is not in Partial Success.', 409);
    await this.leases.release(leaseId, ownerSessionHash);
  }
}
