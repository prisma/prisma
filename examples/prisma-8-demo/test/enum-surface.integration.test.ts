import pgvector from '@prisma/orm-extension-pgvector/runtime';
import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import postgres from '@prisma/orm-postgres/runtime';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { contract } from '../prisma/contract';
import { sql } from '../src/prisma-no-emit/context';
import { getPostsByPriority, getPriorityEnum } from '../src/prisma-no-emit/priority-feed';
import { initTestDatabase } from './utils/control-client';

const authorId = '00000000-0000-0000-0000-000000000001';

// Posts whose `Priority` enum values are deliberately out of declaration order
// so the ORDER BY assertion below is meaningful. Post ids are uuids so the
// secondary sort key is stable.
const seed = [
  {
    id: '10000000-0000-0000-0000-00000000000a',
    title: 'Ship it',
    userId: authorId,
    priority: 'high',
  },
  {
    id: '10000000-0000-0000-0000-00000000000b',
    title: 'Sketch',
    userId: authorId,
    priority: 'low',
  },
  {
    id: '10000000-0000-0000-0000-00000000000c',
    title: 'Polish',
    userId: authorId,
    priority: 'urgent',
  },
  { id: '10000000-0000-0000-0000-00000000000d', title: 'Draft', userId: authorId, priority: 'low' },
] as const;

async function openRuntime(
  connectionString: string,
): Promise<{ runtime: Runtime; close: () => Promise<void> }> {
  const client = postgres({
    contract,
    url: connectionString,
    extensions: [pgvector],
  });
  const runtime = await client.connect();
  return { runtime, close: () => client.close() };
}

describe('TS-authored enum on the demo contract (Post.priority)', () => {
  it(
    'db.enums exposes the declaration-ordered runtime surface',
    async () => {
      await withDevDatabase(async ({ connectionString }) => {
        await initTestDatabase({ connection: connectionString, contract });
        const { close } = await openRuntime(connectionString);
        try {
          const priority = getPriorityEnum();
          expect(priority.values).toEqual(['low', 'high', 'urgent']);
          expect(priority.names).toEqual(['Low', 'High', 'Urgent']);
          expect(priority.members.Urgent).toBe('urgent');
          expect(priority.has('high')).toBe(true);
          const notAMember = 'nope' as 'low' | 'high' | 'urgent';
          expect(priority.has(notAMember)).toBe(false);
          expect(priority.ordinalOf('urgent')).toBe(2);
        } finally {
          await close();
        }
      }, {});
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'reading Post.priority narrows to the value union and sorts by declaration order',
    async () => {
      await withDevDatabase(async ({ connectionString }) => {
        await initTestDatabase({ connection: connectionString, contract });
        const { runtime, close } = await openRuntime(connectionString);
        try {
          await runtime.execute(
            sql.user.insert([{ id: authorId, email: 'author@example.com', kind: 'user' }]).build(),
          );
          await runtime.execute(sql.post.insert([...seed]).build());

          const ordered = await getPostsByPriority(runtime);

          // The read narrows to the enum's own value union, not string. The
          // expected type is taken from the `db.enums` surface rather than
          // re-typed by hand, and asserted against the inferred row type with
          // no annotation — so a widening to `string` fails here.
          type PriorityValue = ReturnType<typeof getPriorityEnum>['values'][number];
          const priorities = ordered.map((row) => row.priority);
          expectTypeOf(priorities).toEqualTypeOf<PriorityValue[]>();

          // Declaration order is low -> high -> urgent; lexical would be
          // high, low, low, urgent.
          expect(priorities).toEqual(['low', 'low', 'high', 'urgent']);
          expect(ordered.map((row) => row.id)).toEqual([
            '10000000-0000-0000-0000-00000000000b',
            '10000000-0000-0000-0000-00000000000d',
            '10000000-0000-0000-0000-00000000000a',
            '10000000-0000-0000-0000-00000000000c',
          ]);
        } finally {
          await close();
        }
      }, {});
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'inserting a post without priority reads back the low default',
    async () => {
      await withDevDatabase(async ({ connectionString }) => {
        await initTestDatabase({ connection: connectionString, contract });
        const { runtime, close } = await openRuntime(connectionString);
        try {
          await runtime.execute(
            sql.user.insert([{ id: authorId, email: 'author@example.com', kind: 'user' }]).build(),
          );
          await runtime.execute(
            sql.post
              .insert([
                {
                  id: '10000000-0000-0000-0000-0000000000fe',
                  title: 'Default priority',
                  userId: authorId,
                },
              ])
              .build(),
          );
          const rows = await runtime.query(
            sql.post
              .select('id', 'priority')
              .where((f, fns) => fns.eq(f.id, '10000000-0000-0000-0000-0000000000fe'))
              .build(),
          );
          expect(rows[0]?.priority).toBe('low');
        } finally {
          await close();
        }
      }, {});
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'the enum CHECK constraint rejects out-of-union values written at runtime',
    async () => {
      await withDevDatabase(async ({ connectionString }) => {
        await initTestDatabase({ connection: connectionString, contract });
        const { runtime, close } = await openRuntime(connectionString);
        try {
          await runtime.execute(
            sql.user.insert([{ id: authorId, email: 'author@example.com', kind: 'user' }]).build(),
          );
          await expect(
            runtime.execute(
              sql.post
                .insert([
                  {
                    id: '10000000-0000-0000-0000-0000000000ff',
                    title: 'Bad',
                    userId: authorId,
                    priority: 'nope' as 'low',
                  },
                ])
                .build(),
            ),
          ).rejects.toThrow();
        } finally {
          await close();
        }
      }, {});
    },
    timeouts.spinUpPpgDev,
  );
});
