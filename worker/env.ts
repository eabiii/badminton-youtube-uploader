export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  SHARED_PASSWORD_HASH: string;
  PASSWORD_VERSION: string;
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: string;
  SESSION_COOKIE_SECURE?: string;
  YOUTUBE_MODE: 'fake' | 'live';
  YOUTUBE_AUDIT_APPROVED: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REFRESH_TOKEN?: string;
  YOUTUBE_PLAYLIST_ID?: string;
};

const pbkdf2HashPattern = /^pbkdf2-sha256:(\d+):([A-Za-z0-9+/]+={0,2}):([A-Za-z0-9+/]+={0,2})$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidPasswordHash(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  const match = pbkdf2HashPattern.exec(value);
  return match !== null && Number(match[1]) === 100_000;
}

export function loginRateLimitWindowMs(env: Bindings): number {
  const seconds = Number(env.LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isSafeInteger(seconds * 1_000)) {
    throw new Error('Invalid login rate-limit window');
  }
  return seconds * 1_000;
}

export function hasValidConfiguration(env: Bindings): boolean {
  try {
    loginRateLimitWindowMs(env);
  } catch {
    return false;
  }
  if (
    !env.DB ||
    typeof env.DB.prepare !== 'function' ||
    !hasValidPasswordHash(env.SHARED_PASSWORD_HASH) ||
    !isNonEmptyString(env.PASSWORD_VERSION) ||
    (env.SESSION_COOKIE_SECURE !== undefined &&
      env.SESSION_COOKIE_SECURE !== 'true' &&
      env.SESSION_COOKIE_SECURE !== 'false') ||
    (env.YOUTUBE_MODE !== 'fake' && env.YOUTUBE_MODE !== 'live') ||
    (env.YOUTUBE_AUDIT_APPROVED !== 'true' && env.YOUTUBE_AUDIT_APPROVED !== 'false')
  ) {
    return false;
  }

  return (
    env.YOUTUBE_MODE === 'fake' ||
    [
      env.YOUTUBE_CLIENT_ID,
      env.YOUTUBE_CLIENT_SECRET,
      env.YOUTUBE_REFRESH_TOKEN,
      env.YOUTUBE_PLAYLIST_ID,
    ].every(isNonEmptyString)
  );
}
