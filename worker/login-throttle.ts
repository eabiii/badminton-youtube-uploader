export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_ATTEMPT_LIMIT = 5;
type AttemptRow = { failed_count: number; window_started_at: number };

export class LoginThrottle {
  constructor(
    private readonly database: D1Database,
    private readonly now: () => number = Date.now,
  ) {}
  async retryAfter(clientHash: string): Promise<number | null> {
    const now = this.now();
    const row = await this.database
      .prepare('SELECT failed_count, window_started_at FROM login_attempts WHERE client_hash = ?')
      .bind(clientHash)
      .first<AttemptRow>();
    if (
      !row ||
      row.window_started_at + LOGIN_WINDOW_MS <= now ||
      row.failed_count < LOGIN_ATTEMPT_LIMIT
    )
      return null;
    return Math.max(1, Math.ceil((row.window_started_at + LOGIN_WINDOW_MS - now) / 1_000));
  }
  async failed(clientHash: string): Promise<void> {
    const now = this.now();
    const windowStart = now - LOGIN_WINDOW_MS;
    await this.database
      .prepare(
        `INSERT INTO login_attempts (client_hash, failed_count, window_started_at)
      VALUES (?, 1, ?) ON CONFLICT(client_hash) DO UPDATE SET
      failed_count = CASE WHEN window_started_at <= ? THEN 1 ELSE failed_count + 1 END,
      window_started_at = CASE WHEN window_started_at <= ? THEN excluded.window_started_at ELSE window_started_at END`,
      )
      .bind(clientHash, now, windowStart, windowStart)
      .run();
  }
  async reset(clientHash: string): Promise<void> {
    await this.database
      .prepare('DELETE FROM login_attempts WHERE client_hash = ?')
      .bind(clientHash)
      .run();
  }
}
