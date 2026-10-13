import { describe, expect, it } from 'vitest';
import { LOGIN_ATTEMPT_LIMIT, LoginThrottle } from '../worker/login-throttle';
import { InMemoryD1 } from './helpers/in-memory-d1';

describe('login throttle', () => {
  it('uses the configured window and reports the remaining retry delay', async () => {
    const database = new InMemoryD1();
    let now = 1_000_000;
    const throttle = new LoginThrottle(database.asDatabase(), 60_000, () => now);

    for (let count = 0; count < LOGIN_ATTEMPT_LIMIT; count += 1) {
      await throttle.failed('client-hash');
    }

    await expect(throttle.retryAfter('client-hash')).resolves.toBe(60);
    now += 59_001;
    await expect(throttle.retryAfter('client-hash')).resolves.toBe(1);
    now += 999;
    await expect(throttle.retryAfter('client-hash')).resolves.toBeNull();
  });

  it('clears failed attempts after a successful login', async () => {
    const database = new InMemoryD1();
    const throttle = new LoginThrottle(database.asDatabase(), 60_000);

    for (let count = 0; count < LOGIN_ATTEMPT_LIMIT; count += 1) {
      await throttle.failed('client-hash');
    }
    await throttle.reset('client-hash');

    await expect(throttle.retryAfter('client-hash')).resolves.toBeNull();
  });
});
