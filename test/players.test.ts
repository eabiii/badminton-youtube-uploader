import { describe, expect, it } from 'vitest';
import app from '../worker/index';
import { PlayerDirectory } from '../worker/players';
import { InMemoryD1 } from './helpers/in-memory-d1';

describe('Player Directory', () => {
  it('normalizes names, sorts deterministically, and rejects concurrent duplicates', async () => {
    const database = new InMemoryD1();
    let sequence = 0;
    const directory = new PlayerDirectory(database.asDatabase(), () => `player-${++sequence}`);
    await directory.add('  Zoë  ');
    await directory.add('alice');
    await expect(directory.add('ＡLICE')).rejects.toMatchObject({ status: 409 });
    expect((await directory.list()).map((entry) => entry.displayName)).toEqual(['alice', 'Zoë']);
    const results = await Promise.allSettled([directory.add('Bob'), directory.add(' bob ')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('renames, merges into the target, removes, and reports conflicts', async () => {
    const database = new InMemoryD1();
    let sequence = 0;
    const directory = new PlayerDirectory(database.asDatabase(), () => `p${++sequence}`);
    const alice = await directory.add('Alice');
    const bob = await directory.add('Bob');
    await expect(directory.rename('missing', 'Nobody')).rejects.toMatchObject({ status: 404 });
    await expect(directory.rename(bob.id, ' alice ')).rejects.toMatchObject({ status: 409 });
    expect(await directory.rename(bob.id, 'Robert')).toEqual({ id: bob.id, displayName: 'Robert' });
    await expect(directory.merge(alice.id, alice.id)).rejects.toMatchObject({ status: 409 });
    expect(await directory.merge(alice.id, bob.id)).toEqual({ id: bob.id, displayName: 'Robert' });
    await directory.remove(bob.id);
    await expect(directory.remove(bob.id)).rejects.toMatchObject({ status: 404 });
  });

  it('requires authentication for Player routes', async () => {
    const response = await app.request('/api/players', {}, {
      DB: new InMemoryD1().asDatabase(),
    } as never);
    expect(response.status).toBe(401);
  });
});
