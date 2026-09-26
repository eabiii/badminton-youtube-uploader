type PlayerRow = { id: string; display_name: string; normalized_name: string; created_at: number };
type QueuingEntryRow = {
  id: string;
  name: string;
  location: string;
  normalized_name: string;
  normalized_location: string;
  created_at: number;
};
type SessionRow = {
  token_hash: string;
  password_version: string;
  created_at: number;
  last_used_at: number;
  revoked_at: number | null;
};
type AttemptRow = { failed_count: number; window_started_at: number };

export class InMemoryD1 {
  readonly players = new Map<string, PlayerRow>();
  readonly queuingEntries = new Map<string, QueuingEntryRow>();
  readonly sessions = new Map<string, SessionRow>();
  readonly attempts = new Map<string, AttemptRow>();

  asDatabase(): D1Database {
    return this as unknown as D1Database;
  }
  prepare(query: string) {
    const sql = query.replace(/\s+/g, ' ').trim();
    const database = this;
    let values: unknown[] = [];
    const statement = {
      bind(...bound: unknown[]) {
        values = bound;
        return statement;
      },
      async first<T>() {
        return database.first(sql, values) as T | null;
      },
      async all<T>() {
        return { success: true, results: database.all(sql, values) as T[], meta: {} };
      },
      async run() {
        return { success: true, meta: { changes: database.run(sql, values) } };
      },
    };
    return statement;
  }

  private first(sql: string, values: unknown[]): unknown {
    if (sql.startsWith('SELECT failed_count')) return this.attempts.get(String(values[0])) ?? null;
    if (sql.startsWith('SELECT token_hash FROM sessions')) {
      const row = this.sessions.get(String(values[0]));
      return row && row.password_version === values[1] && row.revoked_at === null
        ? { token_hash: row.token_hash }
        : null;
    }
    throw new Error(`Unsupported first query: ${sql}`);
  }

  private all(sql: string, values: unknown[]): unknown[] {
    if (sql.includes('FROM players WHERE id IN'))
      return [...this.players.values()]
        .filter((row) => values.includes(row.id))
        .map(({ id, display_name }) => ({ id, display_name }))
        .sort((a, b) => a.id.localeCompare(b.id));
    if (sql.includes('FROM players ORDER BY'))
      return [...this.players.values()]
        .sort(
          (a, b) => a.normalized_name.localeCompare(b.normalized_name) || a.id.localeCompare(b.id),
        )
        .map(({ id, display_name }) => ({ id, display_name }));
    if (sql.includes('FROM queuing_entries'))
      return [...this.queuingEntries.values()]
        .sort(
          (a, b) =>
            a.normalized_name.localeCompare(b.normalized_name) ||
            a.normalized_location.localeCompare(b.normalized_location) ||
            a.id.localeCompare(b.id),
        )
        .map(({ id, name, location }) => ({ id, name, location }));
    throw new Error(`Unsupported all query: ${sql}`);
  }

  private run(sql: string, values: unknown[]): number {
    if (sql.startsWith('INSERT INTO login_attempts')) {
      const hash = String(values[0]);
      const now = Number(values[1]);
      const cutoff = Number(values[2]);
      const previous = this.attempts.get(hash);
      this.attempts.set(
        hash,
        !previous || previous.window_started_at <= cutoff
          ? { failed_count: 1, window_started_at: now }
          : { ...previous, failed_count: previous.failed_count + 1 },
      );
      return 1;
    }
    if (sql.startsWith('DELETE FROM login_attempts'))
      return this.attempts.delete(String(values[0])) ? 1 : 0;
    if (sql.startsWith('INSERT INTO sessions')) {
      const [token_hash, password_version, created_at, last_used_at] = values;
      this.sessions.set(String(token_hash), {
        token_hash: String(token_hash),
        password_version: String(password_version),
        created_at: Number(created_at),
        last_used_at: Number(last_used_at),
        revoked_at: null,
      });
      return 1;
    }
    if (sql.startsWith('UPDATE sessions SET last_used_at')) {
      const row = this.sessions.get(String(values[1]));
      if (!row) return 0;
      row.last_used_at = Number(values[0]);
      return 1;
    }
    if (sql.startsWith('UPDATE sessions SET revoked_at')) {
      const row = this.sessions.get(String(values[1]));
      if (!row) return 0;
      row.revoked_at = Number(values[0]);
      return 1;
    }
    if (sql.startsWith('INSERT INTO players')) {
      const [id, display_name, normalized_name, created_at] = values;
      if ([...this.players.values()].some((row) => row.normalized_name === normalized_name))
        throw new Error('UNIQUE constraint failed: players.normalized_name');
      this.players.set(String(id), {
        id: String(id),
        display_name: String(display_name),
        normalized_name: String(normalized_name),
        created_at: Number(created_at),
      });
      return 1;
    }
    if (sql.startsWith('UPDATE players SET')) {
      const row = this.players.get(String(values[2]));
      if (!row) return 0;
      if (
        [...this.players.values()].some(
          (other) => other.id !== row.id && other.normalized_name === values[1],
        )
      )
        throw new Error('UNIQUE constraint failed: players.normalized_name');
      row.display_name = String(values[0]);
      row.normalized_name = String(values[1]);
      return 1;
    }
    if (sql.startsWith('DELETE FROM players'))
      return this.players.delete(String(values[0])) ? 1 : 0;
    if (sql.startsWith('INSERT INTO queuing_entries')) {
      const [id, name, location, normalized_name, normalized_location, created_at] = values;
      if (
        [...this.queuingEntries.values()].some(
          (row) =>
            row.normalized_name === normalized_name &&
            row.normalized_location === normalized_location,
        )
      )
        throw new Error(
          'UNIQUE constraint failed: queuing_entries.normalized_name, queuing_entries.normalized_location',
        );
      this.queuingEntries.set(String(id), {
        id: String(id),
        name: String(name),
        location: String(location),
        normalized_name: String(normalized_name),
        normalized_location: String(normalized_location),
        created_at: Number(created_at),
      });
      return 1;
    }
    if (sql.startsWith('UPDATE queuing_entries SET')) {
      const row = this.queuingEntries.get(String(values[4]));
      if (!row) return 0;
      if (
        [...this.queuingEntries.values()].some(
          (other) =>
            other.id !== row.id &&
            other.normalized_name === values[2] &&
            other.normalized_location === values[3],
        )
      )
        throw new Error(
          'UNIQUE constraint failed: queuing_entries.normalized_name, queuing_entries.normalized_location',
        );
      row.name = String(values[0]);
      row.location = String(values[1]);
      row.normalized_name = String(values[2]);
      row.normalized_location = String(values[3]);
      return 1;
    }
    if (sql.startsWith('DELETE FROM queuing_entries'))
      return this.queuingEntries.delete(String(values[0])) ? 1 : 0;
    throw new Error(`Unsupported run query: ${sql}`);
  }
}
