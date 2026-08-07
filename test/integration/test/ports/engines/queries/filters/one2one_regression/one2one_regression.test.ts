import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/filters/one2one_regression', () => {
  it(
    'work_with_nulls',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.User.create({ id: 1, name: 'Bob', friendId: null });
        const bob = await db.public.User.where({ id: 1 })
          .select('id', 'name')
          .include('friend', (friend) => friend.select('name'))
          .include('friendOf', (friendOf) => friendOf.select('name'))
          .first();
        expect(bob).toEqual({ id: 1, name: 'Bob', friend: null, friendOf: null });

        await db.public.User.create({ id: 2, name: 'Alice', friendId: 1 });
        const alice = await db.public.User.where({ id: 2 })
          .select('id', 'name')
          .include('friend', (friend) => friend.select('name'))
          .include('friendOf', (friendOf) => friendOf.select('name'))
          .first();
        expect(alice).toEqual({
          id: 2,
          name: 'Alice',
          friend: { name: 'Bob' },
          friendOf: null,
        });

        const noFriend = await db.public.User.where((user) => user.friend.none())
          .select('id', 'name')
          .include('friend', (friend) => friend.select('name'))
          .include('friendOf', (friendOf) => friendOf.select('name'))
          .all();
        expect(noFriend).toEqual([
          { id: 1, name: 'Bob', friend: null, friendOf: { name: 'Alice' } },
        ]);

        const noFriendOf = await db.public.User.where((user) => user.friendOf.none())
          .select('id', 'name')
          .include('friend', (friend) => friend.select('name'))
          .include('friendOf', (friendOf) => friendOf.select('name'))
          .all();
        expect(noFriendOf).toEqual([
          { id: 2, name: 'Alice', friend: { name: 'Bob' }, friendOf: null },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );
});
