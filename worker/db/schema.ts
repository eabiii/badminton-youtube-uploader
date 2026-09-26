import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  passwordVersion: text('password_version').notNull(),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at').notNull(),
  revokedAt: integer('revoked_at'),
});

export const uploadLease = sqliteTable('upload_lease', {
  singleton: integer('singleton').primaryKey(),
  leaseId: text('lease_id'),
  ownerSessionHash: text('owner_session_hash'),
  expiresAt: integer('expires_at'),
  state: text('state'),
  uploadUrl: text('upload_url'),
  uploadLength: integer('upload_length'),
  uploadedBytes: integer('uploaded_bytes'),
  videoId: text('video_id'),
  metadataJson: text('metadata_json'),
});

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  createdAt: integer('created_at').notNull(),
});

export const queuingEntries = sqliteTable(
  'queuing_entries',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    location: text('location').notNull(),
    normalizedName: text('normalized_name').notNull(),
    normalizedLocation: text('normalized_location').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('queuing_entries_normalized_name_location_unique').on(
      table.normalizedName,
      table.normalizedLocation,
    ),
  ],
);

export const loginAttempts = sqliteTable('login_attempts', {
  clientHash: text('client_hash').primaryKey(),
  failedCount: integer('failed_count').notNull(),
  windowStartedAt: integer('window_started_at').notNull(),
});
