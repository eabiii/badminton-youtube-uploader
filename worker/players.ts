import type { Player } from '../shared/domain';
import { normalizePlayerName, playerDisplayNameSchema } from '../shared/domain';

export class PlayerDirectoryError extends Error {
  constructor(message: string, readonly status: 404 | 409) { super(message); }
}
type PlayerRow = { id: string; display_name: string };
const toPlayer = (row: PlayerRow): Player => ({ id: row.id, displayName: row.display_name });
const isConstraintError = (error: unknown) => error instanceof Error && /unique|constraint/i.test(error.message);

export class PlayerDirectory {
  constructor(private readonly database: D1Database, private readonly newId: () => string = () => crypto.randomUUID()) {}

  async list(): Promise<Player[]> {
    const result = await this.database.prepare('SELECT id, display_name FROM players ORDER BY normalized_name ASC, id ASC').all<PlayerRow>();
    return result.results.map(toPlayer);
  }

  async add(input: unknown): Promise<Player> {
    const displayName = playerDisplayNameSchema.parse(input);
    const created = { id: this.newId(), displayName };
    try {
      await this.database.prepare('INSERT INTO players (id, display_name, normalized_name, created_at) VALUES (?, ?, ?, ?)')
        .bind(created.id, displayName, normalizePlayerName(displayName), Date.now()).run();
      return created;
    } catch (error) {
      if (isConstraintError(error)) throw new PlayerDirectoryError('A Player with that display name already exists.', 409);
      throw error;
    }
  }

  async rename(id: string, input: unknown): Promise<Player> {
    const displayName = playerDisplayNameSchema.parse(input);
    try {
      const result = await this.database.prepare('UPDATE players SET display_name = ?, normalized_name = ? WHERE id = ?')
        .bind(displayName, normalizePlayerName(displayName), id).run();
      if ((result.meta.changes ?? 0) !== 1) throw new PlayerDirectoryError('Player not found.', 404);
      return { id, displayName };
    } catch (error) {
      if (error instanceof PlayerDirectoryError) throw error;
      if (isConstraintError(error)) throw new PlayerDirectoryError('A Player with that display name already exists.', 409);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.database.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
    if ((result.meta.changes ?? 0) !== 1) throw new PlayerDirectoryError('Player not found.', 404);
  }

  async merge(sourceId: string, targetId: string): Promise<Player> {
    if (sourceId === targetId) throw new PlayerDirectoryError('A Player cannot be merged into itself.', 409);
    const rows = await this.database.prepare('SELECT id, display_name FROM players WHERE id IN (?, ?) ORDER BY id')
      .bind(sourceId, targetId).all<PlayerRow>();
    const source = rows.results.find((row) => row.id === sourceId);
    const target = rows.results.find((row) => row.id === targetId);
    if (!source || !target) throw new PlayerDirectoryError('Player not found.', 404);
    const result = await this.database.prepare('DELETE FROM players WHERE id = ?').bind(sourceId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new PlayerDirectoryError('The Player Directory changed. Try again.', 409);
    return toPlayer(target);
  }
}
