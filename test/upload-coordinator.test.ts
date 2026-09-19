import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, LEASE_DURATION_MS, type GameUploadMetadata } from '../shared/domain';
import { UploadCoordinator, UploadError } from '../worker/upload/coordinator';
import type { ChunkResult, PublisherMetadata, YouTubePublisher } from '../worker/upload/publisher';
import { InMemoryLeaseRepository } from './helpers/in-memory-lease-repository';

const metadata: GameUploadMetadata = {
  fileName: 'game.mp4',
  fileSize: CHUNK_SIZE + 7,
  mimeType: 'video/mp4',
  matchType: 'Singles Match',
  players: ['Alice', 'Bob'],
  titleNames: ['Alice', 'Bob'],
  matchDate: '2026-09-07',
  title: 'Alice vs Bob | Singles Match | September 7, 2026',
  description: '',
  requestedVisibility: 'Public',
};

class RecordingPublisher implements YouTubePublisher {
  offsetValue = 0;
  creates: PublisherMetadata[] = [];
  uploads = 0;
  playlistAttempts = 0;
  failPlaylist = false;

  async create(input: PublisherMetadata) {
    this.creates.push(input);
    return 'server-only-upload-url';
  }
  async offset(_url: string, length: number) {
    return this.offsetValue === length
      ? { nextOffset: this.offsetValue, videoId: 'video-1' }
      : { nextOffset: this.offsetValue };
  }
  async upload(
    _url: string,
    bytes: ArrayBuffer,
    start: number,
    length: number,
  ): Promise<ChunkResult> {
    this.uploads += 1;
    this.offsetValue = start + bytes.byteLength;
    return this.offsetValue === length
      ? { complete: true, nextOffset: this.offsetValue, videoId: 'video-1' }
      : { complete: false, nextOffset: this.offsetValue };
  }
  async addToDestinationPlaylist() {
    this.playlistAttempts += 1;
    if (this.failPlaylist) throw new Error('playlist unavailable');
  }
}

describe('UploadCoordinator', () => {
  it('allows only one active Game Upload across sessions', async () => {
    const coordinator = new UploadCoordinator(
      new InMemoryLeaseRepository(),
      new RecordingPublisher(),
      false,
      () => 1_000,
    );
    await coordinator.start('session-a', metadata);
    await expect(coordinator.start('session-b', metadata)).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<UploadError>);
    await expect(coordinator.status('session-b')).resolves.toEqual({ busy: true });
  });

  it('forces effective Visibility to Private before audit approval', async () => {
    const publisher = new RecordingPublisher();
    const upload = await new UploadCoordinator(
      new InMemoryLeaseRepository(),
      publisher,
      false,
    ).start('session', metadata);
    expect(upload.requestedVisibility).toBe('Public');
    expect(upload.effectiveVisibility).toBe('Private');
    expect(publisher.creates[0]?.effectiveVisibility).toBe('Private');
    expect(JSON.stringify(upload)).not.toContain('server-only-upload-url');
  });

  it('expires an abandoned lease and lets another session acquire it', async () => {
    let now = 1_000;
    const coordinator = new UploadCoordinator(
      new InMemoryLeaseRepository(),
      new RecordingPublisher(),
      false,
      () => now,
    );
    await coordinator.start('session-a', metadata);
    now += LEASE_DURATION_MS + 1;
    await expect(coordinator.start('session-b', metadata)).resolves.toMatchObject({
      uploadedBytes: 0,
    });
  });

  it('renews the lease with a heartbeat', async () => {
    let now = 1_000;
    const leases = new InMemoryLeaseRepository();
    const coordinator = new UploadCoordinator(leases, new RecordingPublisher(), false, () => now);
    const upload = await coordinator.start('session', metadata);
    now += 30_000;
    await coordinator.heartbeat('session', upload.leaseId);
    expect(leases.record?.expiresAt).toBe(now + LEASE_DURATION_MS);
  });

  it('reconciles against the publisher offset before relaying a retry', async () => {
    const publisher = new RecordingPublisher();
    publisher.offsetValue = CHUNK_SIZE;
    const coordinator = new UploadCoordinator(new InMemoryLeaseRepository(), publisher, false);
    const upload = await coordinator.start('session', metadata);
    await expect(
      coordinator.uploadChunk('session', upload.leaseId, 0, new ArrayBuffer(CHUNK_SIZE)),
    ).rejects.toMatchObject({ status: 409, offset: CHUNK_SIZE });
    expect(publisher.uploads).toBe(0);
  });

  it('finishes playlist insertion without re-uploading after a lost final response', async () => {
    const publisher = new RecordingPublisher();
    const coordinator = new UploadCoordinator(new InMemoryLeaseRepository(), publisher, false);
    const upload = await coordinator.start('session', { ...metadata, fileSize: 7 });
    publisher.offsetValue = 7;
    const result = await coordinator.uploadChunk('session', upload.leaseId, 0, new ArrayBuffer(7));
    expect(result.complete).toBe(true);
    expect(publisher.uploads).toBe(0);
    expect(publisher.playlistAttempts).toBe(1);
  });

  it('retries only playlist insertion after Partial Success', async () => {
    const publisher = new RecordingPublisher();
    publisher.failPlaylist = true;
    const coordinator = new UploadCoordinator(new InMemoryLeaseRepository(), publisher, false);
    const upload = await coordinator.start('session', { ...metadata, fileSize: 7 });
    const result = await coordinator.uploadChunk('session', upload.leaseId, 0, new ArrayBuffer(7));
    expect(result.upload?.state).toBe('partial_success');
    expect(publisher.uploads).toBe(1);
    publisher.failPlaylist = false;
    await coordinator.retryPlaylist('session', upload.leaseId);
    expect(publisher.uploads).toBe(1);
    expect(publisher.playlistAttempts).toBe(2);
  });

  it('cancellation releases the singleton lease', async () => {
    const coordinator = new UploadCoordinator(
      new InMemoryLeaseRepository(),
      new RecordingPublisher(),
      false,
    );
    const upload = await coordinator.start('session-a', metadata);
    await coordinator.cancel('session-a', upload.leaseId);
    await expect(coordinator.start('session-b', metadata)).resolves.toBeDefined();
  });

  it("rejects ownership and expiration violations without releasing another session's lease", async () => {
    let now = 1_000;
    const leases = new InMemoryLeaseRepository();
    const coordinator = new UploadCoordinator(leases, new RecordingPublisher(), false, () => now);
    const upload = await coordinator.start('session-a', metadata);
    await expect(coordinator.cancel('session-b', upload.leaseId)).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<UploadError>);
    await expect(coordinator.status('session-a')).resolves.toMatchObject({ busy: true });
    now += LEASE_DURATION_MS + 1;
    await expect(coordinator.heartbeat('session-a', upload.leaseId)).rejects.toMatchObject({
      status: 410,
    } satisfies Partial<UploadError>);
  });

  it('rejects empty and non-final short chunks', async () => {
    const coordinator = new UploadCoordinator(
      new InMemoryLeaseRepository(),
      new RecordingPublisher(),
      false,
    );
    const upload = await coordinator.start('session', metadata);
    await expect(
      coordinator.uploadChunk('session', upload.leaseId, 0, new ArrayBuffer(0)),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<UploadError>);
    await expect(
      coordinator.uploadChunk('session', upload.leaseId, 0, new ArrayBuffer(7)),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<UploadError>);
  });

  it('accepts Partial Success and releases its transient state', async () => {
    const publisher = new RecordingPublisher();
    publisher.failPlaylist = true;
    const coordinator = new UploadCoordinator(new InMemoryLeaseRepository(), publisher, false);
    const upload = await coordinator.start('session-a', { ...metadata, fileSize: 7 });
    await coordinator.uploadChunk('session-a', upload.leaseId, 0, new ArrayBuffer(7));
    await coordinator.acceptPartialSuccess('session-a', upload.leaseId);
    await expect(coordinator.status('session-a')).resolves.toEqual({ busy: false });
    await expect(
      coordinator.acceptPartialSuccess('session-a', upload.leaseId),
    ).rejects.toMatchObject({ status: 410 } satisfies Partial<UploadError>);
  });
});
