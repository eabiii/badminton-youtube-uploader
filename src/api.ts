import { z } from 'zod';
import {
  errorResponseSchema,
  playerListResponseSchema,
  playerSchema,
  queuingEntryListResponseSchema,
  queuingEntrySchema,
  sessionResponseSchema,
  uploadViewSchema,
  type GameUploadMetadata,
  type Player,
  type QueuingEntry,
} from '../shared/domain';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly offset?: number,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(await response.json().catch(() => ({})));
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new ApiError(
      parsed.success ? parsed.data.error : `Request failed (${response.status}).`,
      response.status,
      parsed.success ? parsed.data.offset : undefined,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  return schema.parse(await response.json());
}

const uploadStatusSchema = z.object({ busy: z.boolean(), upload: uploadViewSchema.optional() });
const chunkResponseSchema = z.object({
  complete: z.boolean(),
  nextOffset: z.number().int().nonnegative(),
  upload: uploadViewSchema.optional(),
});
const authenticatedSchema = z.object({ authenticated: z.literal(true) });
const loggedOutSchema = z.object({ authenticated: z.literal(false) });

const json = (body: unknown, method: string): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  session: () => request('/api/session', sessionResponseSchema),
  login: (password: string) =>
    request('/api/login', authenticatedSchema, json({ password }, 'POST')),
  logout: () => request('/api/logout', loggedOutSchema, { method: 'POST' }),
  players: () => request('/api/players', playerListResponseSchema),
  addPlayer: (displayName: string) =>
    request('/api/players', playerSchema, json({ displayName }, 'POST')),
  renamePlayer: (id: string, displayName: string) =>
    request(`/api/players/${encodeURIComponent(id)}`, playerSchema, json({ displayName }, 'PATCH')),
  mergePlayer: (sourceId: string, targetPlayerId: string) =>
    request(
      `/api/players/${encodeURIComponent(sourceId)}/merge`,
      playerSchema,
      json({ targetPlayerId }, 'POST'),
    ),
  removePlayer: (id: string) =>
    request(`/api/players/${encodeURIComponent(id)}`, z.void(), { method: 'DELETE' }),
  queuingEntries: () => request('/api/queuing-entries', queuingEntryListResponseSchema),
  addQueuingEntry: (name: string, location: string) =>
    request('/api/queuing-entries', queuingEntrySchema, json({ name, location }, 'POST')),
  updateQueuingEntry: (id: string, name: string, location: string) =>
    request(
      `/api/queuing-entries/${encodeURIComponent(id)}`,
      queuingEntrySchema,
      json({ name, location }, 'PATCH'),
    ),
  removeQueuingEntry: (id: string) =>
    request(`/api/queuing-entries/${encodeURIComponent(id)}`, z.void(), { method: 'DELETE' }),
  status: () => request('/api/upload/status', uploadStatusSchema),
  start: (metadata: GameUploadMetadata) =>
    request('/api/upload/start', uploadViewSchema, json(metadata, 'POST')),
  heartbeat: (leaseId: string) =>
    request(`/api/upload/${leaseId}/heartbeat`, z.void(), { method: 'POST' }),
  chunk: (leaseId: string, offset: number, bytes: Blob, signal?: AbortSignal) =>
    request(`/api/upload/${leaseId}/chunk`, chunkResponseSchema, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'x-upload-offset': String(offset) },
      body: bytes,
      signal,
    }),
  cancel: (leaseId: string) =>
    request(`/api/upload/${leaseId}/cancel`, z.void(), { method: 'POST' }),
  retryPlaylist: (leaseId: string) =>
    request(`/api/upload/${leaseId}/retry-playlist`, uploadViewSchema, { method: 'POST' }),
  acceptPartialSuccess: (leaseId: string) =>
    request(`/api/upload/${leaseId}/accept-partial-success`, z.void(), { method: 'POST' }),
};

export type { Player, QueuingEntry };
