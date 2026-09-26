import { describe, expect, it } from 'vitest';
import app from '../worker/index';
import { QueuingDirectory } from '../worker/queuing-entries';
import { InMemoryD1 } from './helpers/in-memory-d1';

describe('Queuing Directory', () => {
  it('normalizes pairs, allows repeated names at different locations, and sorts deterministically', async () => {
    const database = new InMemoryD1();
    let sequence = 0;
    const directory = new QueuingDirectory(database.asDatabase(), () => `queue-${++sequence}`);
    await directory.add({ name: '  Zoë Club ', location: ' North Hall ' });
    await directory.add({ name: 'alpha club', location: 'West Hall' });
    await directory.add({ name: 'Zoë Club', location: 'East Hall' });
    await expect(
      directory.add({ name: ' ＺOË CLUB ', location: ' north hall ' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await directory.list()).toEqual([
      { id: 'queue-2', name: 'alpha club', location: 'West Hall' },
      { id: 'queue-3', name: 'Zoë Club', location: 'East Hall' },
      { id: 'queue-1', name: 'Zoë Club', location: 'North Hall' },
    ]);
  });

  it('uses the database constraint to reject concurrent duplicates', async () => {
    const database = new InMemoryD1();
    let sequence = 0;
    const directory = new QueuingDirectory(database.asDatabase(), () => `queue-${++sequence}`);
    const results = await Promise.allSettled([
      directory.add({ name: 'GOODSHOTS!', location: 'Central Park' }),
      directory.add({ name: ' goodshots! ', location: ' Ｃentral Park ' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('updates both fields, removes entries, and reports conflicts and missing entries', async () => {
    const database = new InMemoryD1();
    let sequence = 0;
    const directory = new QueuingDirectory(database.asDatabase(), () => `queue-${++sequence}`);
    const first = await directory.add({ name: 'Club Night', location: 'Hall A' });
    const second = await directory.add({ name: 'Club Night', location: 'Hall B' });
    await expect(
      directory.update(second.id, { name: ' club night ', location: ' hall a ' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      directory.update('missing', { name: 'Nobody', location: 'Nowhere' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      directory.update(second.id, { name: 'Friday Games', location: 'Sports Centre' }),
    ).resolves.toEqual({
      id: second.id,
      name: 'Friday Games',
      location: 'Sports Centre',
    });
    await directory.remove(first.id);
    await expect(directory.remove(first.id)).rejects.toMatchObject({ status: 404 });
  });

  it('requires authentication for Queuing Directory routes', async () => {
    const response = await app.request('/api/queuing-entries', {}, {
      DB: new InMemoryD1().asDatabase(),
    } as never);
    expect(response.status).toBe(401);
  });
});
