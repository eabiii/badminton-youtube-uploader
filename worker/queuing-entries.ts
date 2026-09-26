import {
  normalizeQueuingValue,
  queuingEntryMutationSchema,
  type QueuingEntry,
} from '../shared/domain';

export class QueuingDirectoryError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
  }
}

type QueuingEntryRow = { id: string; name: string; location: string };
const toEntry = (row: QueuingEntryRow): QueuingEntry => ({
  id: row.id,
  name: row.name,
  location: row.location,
});
const isConstraintError = (error: unknown) =>
  error instanceof Error && /unique|constraint/i.test(error.message);

export class QueuingDirectory {
  constructor(
    private readonly database: D1Database,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async list(): Promise<QueuingEntry[]> {
    const result = await this.database
      .prepare(
        `SELECT id, name, location FROM queuing_entries
         ORDER BY normalized_name ASC, normalized_location ASC, id ASC`,
      )
      .all<QueuingEntryRow>();
    return result.results.map(toEntry);
  }

  async add(input: unknown): Promise<QueuingEntry> {
    const { name, location } = queuingEntryMutationSchema.parse(input);
    const created = { id: this.newId(), name, location };
    try {
      await this.database
        .prepare(
          `INSERT INTO queuing_entries
           (id, name, location, normalized_name, normalized_location, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          created.id,
          name,
          location,
          normalizeQueuingValue(name),
          normalizeQueuingValue(location),
          Date.now(),
        )
        .run();
      return created;
    } catch (error) {
      if (isConstraintError(error))
        throw new QueuingDirectoryError(
          'A Queuing entry with that name and location already exists.',
          409,
        );
      throw error;
    }
  }

  async update(id: string, input: unknown): Promise<QueuingEntry> {
    const { name, location } = queuingEntryMutationSchema.parse(input);
    try {
      const result = await this.database
        .prepare(
          `UPDATE queuing_entries
           SET name = ?, location = ?, normalized_name = ?, normalized_location = ?
           WHERE id = ?`,
        )
        .bind(name, location, normalizeQueuingValue(name), normalizeQueuingValue(location), id)
        .run();
      if ((result.meta.changes ?? 0) !== 1)
        throw new QueuingDirectoryError('Queuing entry not found.', 404);
      return { id, name, location };
    } catch (error) {
      if (error instanceof QueuingDirectoryError) throw error;
      if (isConstraintError(error))
        throw new QueuingDirectoryError(
          'A Queuing entry with that name and location already exists.',
          409,
        );
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.database
      .prepare('DELETE FROM queuing_entries WHERE id = ?')
      .bind(id)
      .run();
    if ((result.meta.changes ?? 0) !== 1)
      throw new QueuingDirectoryError('Queuing entry not found.', 404);
  }
}
