export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  SHARED_PASSWORD_HASH: string;
  PASSWORD_VERSION: string;
  SESSION_COOKIE_SECURE?: string;
  YOUTUBE_MODE: 'fake' | 'live';
  YOUTUBE_AUDIT_APPROVED: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REFRESH_TOKEN?: string;
  YOUTUBE_PLAYLIST_ID?: string;
};
