import { LEASE_DURATION_MS, type GameUploadMetadata, type UploadState, type Visibility } from '../../shared/domain';

export type LeaseRecord = {
  leaseId: string;
  ownerSessionHash: string;
  expiresAt: number;
  state: UploadState;
  uploadUrl: string | null;
  uploadLength: number;
  uploadedBytes: number;
  videoId: string | null;
  metadata: GameUploadMetadata;
  effectiveVisibility: Visibility;
};

export interface LeaseRepository {
  acquire(record: LeaseRecord, now: number): Promise<boolean>;
  findActive(now: number): Promise<LeaseRecord | null>;
  attachUploadUrl(leaseId: string, ownerSessionHash: string, uploadUrl: string): Promise<void>;
  renew(leaseId: string, ownerSessionHash: string, now: number): Promise<boolean>;
  updateProgress(leaseId: string, ownerSessionHash: string, uploadedBytes: number, now: number): Promise<void>;
  markPartialSuccess(leaseId: string, ownerSessionHash: string, videoId: string, now: number): Promise<void>;
  release(leaseId: string, ownerSessionHash: string): Promise<void>;
}

type D1LeaseRow = {
  lease_id: string;
  owner_session_hash: string;
  expires_at: number;
  state: UploadState;
  upload_url: string | null;
  upload_length: number;
  uploaded_bytes: number;
  video_id: string | null;
  metadata_json: string;
};

function toRecord(row: D1LeaseRow): LeaseRecord {
  const stored = JSON.parse(row.metadata_json) as {
    metadata: GameUploadMetadata;
    effectiveVisibility: Visibility;
  };
  return {
    leaseId: row.lease_id,
    ownerSessionHash: row.owner_session_hash,
    expiresAt: row.expires_at,
    state: row.state,
    uploadUrl: row.upload_url,
    uploadLength: row.upload_length,
    uploadedBytes: row.uploaded_bytes,
    videoId: row.video_id,
    metadata: stored.metadata,
    effectiveVisibility: stored.effectiveVisibility,
  };
}

export class D1LeaseRepository implements LeaseRepository {
  constructor(private readonly database: D1Database) {}

  async acquire(record: LeaseRecord, now: number): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE upload_lease SET
          lease_id = ?, owner_session_hash = ?, expires_at = ?, state = ?, upload_url = ?,
          upload_length = ?, uploaded_bytes = ?, video_id = ?, metadata_json = ?
        WHERE singleton = 1 AND (lease_id IS NULL OR expires_at <= ?)`,
      )
      .bind(
        record.leaseId,
        record.ownerSessionHash,
        record.expiresAt,
        record.state,
        record.uploadUrl,
        record.uploadLength,
        record.uploadedBytes,
        record.videoId,
        JSON.stringify({ metadata: record.metadata, effectiveVisibility: record.effectiveVisibility }),
        now,
      )
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async findActive(now: number): Promise<LeaseRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT lease_id, owner_session_hash, expires_at, state, upload_url, upload_length,
          uploaded_bytes, video_id, metadata_json
        FROM upload_lease WHERE singleton = 1 AND lease_id IS NOT NULL AND expires_at > ?`,
      )
      .bind(now)
      .first<D1LeaseRow>();
    return row ? toRecord(row) : null;
  }

  async attachUploadUrl(leaseId: string, ownerSessionHash: string, uploadUrl: string): Promise<void> {
    await this.database
      .prepare('UPDATE upload_lease SET upload_url = ? WHERE singleton = 1 AND lease_id = ? AND owner_session_hash = ?')
      .bind(uploadUrl, leaseId, ownerSessionHash)
      .run();
  }

  async renew(leaseId: string, ownerSessionHash: string, now: number): Promise<boolean> {
    const result = await this.database
      .prepare(
        'UPDATE upload_lease SET expires_at = ? WHERE singleton = 1 AND lease_id = ? AND owner_session_hash = ? AND expires_at > ?',
      )
      .bind(now + LEASE_DURATION_MS, leaseId, ownerSessionHash, now)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async updateProgress(leaseId: string, ownerSessionHash: string, uploadedBytes: number, now: number): Promise<void> {
    await this.database
      .prepare(
        'UPDATE upload_lease SET uploaded_bytes = ?, expires_at = ? WHERE singleton = 1 AND lease_id = ? AND owner_session_hash = ?',
      )
      .bind(uploadedBytes, now + LEASE_DURATION_MS, leaseId, ownerSessionHash)
      .run();
  }

  async markPartialSuccess(leaseId: string, ownerSessionHash: string, videoId: string, now: number): Promise<void> {
    await this.database
      .prepare(
        `UPDATE upload_lease SET state = 'partial_success', video_id = ?, uploaded_bytes = upload_length,
          expires_at = ? WHERE singleton = 1 AND lease_id = ? AND owner_session_hash = ?`,
      )
      .bind(videoId, now + LEASE_DURATION_MS, leaseId, ownerSessionHash)
      .run();
  }

  async release(leaseId: string, ownerSessionHash: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE upload_lease SET lease_id = NULL, owner_session_hash = NULL, expires_at = NULL,
          state = 'idle', upload_url = NULL, upload_length = NULL, uploaded_bytes = 0,
          video_id = NULL, metadata_json = NULL
        WHERE singleton = 1 AND lease_id = ? AND owner_session_hash = ?`,
      )
      .bind(leaseId, ownerSessionHash)
      .run();
  }
}
