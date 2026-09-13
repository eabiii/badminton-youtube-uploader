import type { LeaseRecord, LeaseRepository } from '../../worker/upload/lease-repository';

export class InMemoryLeaseRepository implements LeaseRepository {
  record: LeaseRecord | null = null;

  async acquire(record: LeaseRecord, now: number): Promise<boolean> {
    if (this.record && this.record.expiresAt > now) return false;
    this.record = structuredClone(record);
    return true;
  }

  async findActive(now: number): Promise<LeaseRecord | null> {
    return this.record && this.record.expiresAt > now ? structuredClone(this.record) : null;
  }

  async attachUploadUrl(leaseId: string, owner: string, uploadUrl: string): Promise<void> {
    if (this.record?.leaseId === leaseId && this.record.ownerSessionHash === owner) this.record.uploadUrl = uploadUrl;
  }

  async renew(leaseId: string, owner: string, now: number): Promise<boolean> {
    if (!this.record || this.record.leaseId !== leaseId || this.record.ownerSessionHash !== owner || this.record.expiresAt <= now) return false;
    this.record.expiresAt = now + 300_000;
    return true;
  }

  async updateProgress(leaseId: string, owner: string, uploadedBytes: number, now: number): Promise<void> {
    if (this.record?.leaseId === leaseId && this.record.ownerSessionHash === owner) {
      this.record.uploadedBytes = uploadedBytes;
      this.record.expiresAt = now + 300_000;
    }
  }

  async markPartialSuccess(leaseId: string, owner: string, videoId: string, now: number): Promise<void> {
    if (this.record?.leaseId === leaseId && this.record.ownerSessionHash === owner) {
      this.record.state = 'partial_success';
      this.record.videoId = videoId;
      this.record.uploadedBytes = this.record.uploadLength;
      this.record.expiresAt = now + 300_000;
    }
  }

  async release(leaseId: string, owner: string): Promise<void> {
    if (this.record?.leaseId === leaseId && this.record.ownerSessionHash === owner) this.record = null;
  }
}
