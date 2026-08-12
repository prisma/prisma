import { describe, expect, it } from 'vitest';
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
import { seedUsers } from './runtime-helpers';

describe('integration/first', () => {
  it(
    'first() returns first matching row and null when no row matches',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Alice', email: 'alice2@example.com' },
        ]);

        const found = await users.first({ name: 'Alice' });
        const foundByFn = await users.first((user) => user.id.eq(2));
        const missing = await users.first({ id: 999 });

        expect(found).not.toBeNull();
        expect(found?.name).toBe('Alice');
        expect(foundByFn).toEqual({
          id: 2,
          name: 'Alice',
          email: 'alice2@example.com',
          invitedById: null,
          address: null,
        });
        expect(missing).toBeNull();
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'first() respects existing orderBy() modifiers',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Bob', email: 'bob-1@example.com' },
          { id: 2, name: 'Bob', email: 'bob-2@example.com' },
          { id: 3, name: 'Cara', email: 'cara@example.com' },
        ]);

        const found = await users
          .where({ name: 'Bob' })
          .orderBy((user) => user.id.desc())
          .first();

        expect(found).toEqual({
          id: 2,
          name: 'Bob',
          email: 'bob-2@example.com',
          invitedById: null,
          address: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );
});
