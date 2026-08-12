import { describe, expect, it } from 'vitest';
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
import { seedUsers } from './runtime-helpers';

function findEmittedSql(executions: readonly { sql: string }[]): string {
  const exec = executions[0];
  if (!exec) throw new Error('no executions captured');
  return exec.sql;
}

describe('integration/self-relations', () => {
  it(
    'include() resolves users -> invitedUsers (1:N) on the same model',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com', invitedById: 1 },
          { id: 3, name: 'Cara', email: 'cara@example.com', invitedById: 1 },
          { id: 4, name: 'Dan', email: 'dan@example.com', invitedById: 2 },
        ]);

        const rows = await users
          .orderBy((user) => user.id.asc())
          .include('invitedUsers', (invitedUsers) =>
            invitedUsers.orderBy((invitedUser) => invitedUser.id.asc()),
          )
          .all();

        expect(rows).toEqual([
          {
            id: 1,
            name: 'Alice',
            email: 'alice@example.com',
            invitedById: null,
            address: null,
            invitedUsers: [
              { id: 2, name: 'Bob', email: 'bob@example.com', invitedById: 1, address: null },
              { id: 3, name: 'Cara', email: 'cara@example.com', invitedById: 1, address: null },
            ],
          },
          {
            id: 2,
            name: 'Bob',
            email: 'bob@example.com',
            invitedById: 1,
            address: null,
            invitedUsers: [
              { id: 4, name: 'Dan', email: 'dan@example.com', invitedById: 2, address: null },
            ],
          },
          {
            id: 3,
            name: 'Cara',
            email: 'cara@example.com',
            invitedById: 1,
            address: null,
            invitedUsers: [],
          },
          {
            id: 4,
            name: 'Dan',
            email: 'dan@example.com',
            invitedById: 2,
            address: null,
            invitedUsers: [],
          },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'orderBy on a depth-1 self-relation include applies against the aliased child table (regression: aliased orderBy remap)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        // Children of Alice are intentionally inserted in non-id order so
        // a missing alias-remap on the inner SELECT's orderBy would emit
        // them in insertion order (correlated against the outer User.id),
        // not in `invitedUser.id.desc()` order.
        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com', invitedById: 1 },
          { id: 4, name: 'Dan', email: 'dan@example.com', invitedById: 1 },
          { id: 3, name: 'Cara', email: 'cara@example.com', invitedById: 1 },
        ]);

        runtime.resetExecutions();
        const rows = await users
          .where((u) => u.id.eq(1))
          .include('invitedUsers', (invitedUsers) =>
            invitedUsers.orderBy((invitedUser) => invitedUser.id.desc()),
          )
          .all();

        expect(rows).toEqual([
          {
            id: 1,
            name: 'Alice',
            email: 'alice@example.com',
            invitedById: null,
            address: null,
            invitedUsers: [
              { id: 4, name: 'Dan', email: 'dan@example.com', invitedById: 1, address: null },
              { id: 3, name: 'Cara', email: 'cara@example.com', invitedById: 1, address: null },
              { id: 2, name: 'Bob', email: 'bob@example.com', invitedById: 1, address: null },
            ],
          },
        ]);

        // The hidden order projection inside the inner rows-subselect
        // must reference the aliased child table, not the original
        // `users` outer source, or Postgres correlates the ORDER BY
        // against the outer row and indeterminacy follows.
        const sql = findEmittedSql(runtime.executions);
        expect(sql).toContain('"invitedUsers__child"."id" AS "invitedUsers__order_0"');
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'include() resolves users -> invitedBy (N:1) on the same model',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com', invitedById: 1 },
          { id: 3, name: 'Cara', email: 'cara@example.com', invitedById: 2 },
        ]);

        const rows = await users
          .orderBy((user) => user.id.asc())
          .include('invitedBy')
          .all();

        expect(rows).toEqual([
          {
            id: 1,
            name: 'Alice',
            email: 'alice@example.com',
            invitedById: null,
            address: null,
            invitedBy: null,
          },
          {
            id: 2,
            name: 'Bob',
            email: 'bob@example.com',
            invitedById: 1,
            address: null,
            invitedBy: {
              id: 1,
              name: 'Alice',
              email: 'alice@example.com',
              invitedById: null,
              address: null,
            },
          },
          {
            id: 3,
            name: 'Cara',
            email: 'cara@example.com',
            invitedById: 2,
            address: null,
            invitedBy: {
              id: 2,
              name: 'Bob',
              email: 'bob@example.com',
              invitedById: 1,
              address: null,
            },
          },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
