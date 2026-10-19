import { buildExecutionSection } from '@internal/contract/hashing';
import {
  AsyncIterableResult,
  applyMutationDefaults,
  collectMutationDefaultGenerators,
  type MutationDefaults,
} from '@internal/framework-components/runtime';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import { MongoFieldFilter } from '@internal/mongo-query-ast/execution';
import { MongoParamRef } from '@internal/mongo-value';
import { describe, expect, it } from 'vitest';
import type { Contract } from '../../../1-foundation/mongo-contract/test/fixtures/stored-names-contract';
import storedNamesContractJson from '../../../1-foundation/mongo-contract/test/fixtures/stored-names-contract.json';
import { createMongoCollection } from '../src/collection';
import type { MongoQueryExecutor } from '../src/executor';
import { noEnums } from './no-enums';

const contract = storedNamesContractJson as unknown as Contract;

const createdAtDefaults: MutationDefaults = {
  applyMutationDefaults: (options) =>
    applyMutationDefaults(
      buildExecutionSection({
        target: 'mongo',
        targetFamily: 'mongo',
        defaults: [
          {
            ref: { namespace: '__unbound__', entry: 'users', field: 'created_at' },
            onCreate: { kind: 'generator', id: 'now' },
          },
        ],
      }),
      collectMutationDefaultGenerators([
        {
          id: 'test',
          mutationDefaultGenerators: () => [
            { id: 'now', generate: () => 'generated', stability: 'field' },
          ],
        },
      ]),
      options,
    ),
};

function recordingExecutor(...responses: unknown[][]) {
  const plans: MongoQueryPlan[] = [];
  let index = 0;
  const executor: MongoQueryExecutor = {
    query<Row>(plan: MongoQueryPlan<Row>): AsyncIterableResult<Row> {
      plans.push(plan as MongoQueryPlan);
      const rows = (responses[index++] ?? []) as Row[];
      async function* gen(): AsyncGenerator<Row> {
        yield* rows;
      }
      return new AsyncIterableResult(gen());
    },
    async execute(plan: MongoQueryPlan) {
      plans.push(plan);
      return { affectedRows: 1 };
    },
  };
  return { executor, plans };
}

function commandOf(plans: readonly MongoQueryPlan[], index: number): unknown {
  const plan = plans[index];
  if (plan === undefined) throw new Error(`expected plan ${index}`);
  return plan.command;
}

const storedUser = {
  _id: 'u1',
  display_name: 'Ada',
  email: null,
  created_at: 'then',
  home_address: { city: 'London' },
  user_addresses: [{ street_name: 'Main St', city: 'London' }],
};

const userRow = {
  id: 'u1',
  displayName: 'Ada',
  email: null,
  createdAt: 'then',
  home: { city: 'London' },
  addresses: [{ street: 'Main St', city: 'London' }],
};

describe('a model whose fields are stored under other names', () => {
  it('reads each document as a row of fields, leaving out stored names no field stores', async () => {
    const { executor } = recordingExecutor([{ ...storedUser, legacy: true }]);
    const rows = await createMongoCollection(contract, 'User', executor, noEnums).all().toArray();
    expect(rows).toEqual([userRow]);
  });

  it('filters, selects and sorts by stored names', async () => {
    const { executor, plans } = recordingExecutor([]);
    await createMongoCollection(contract, 'User', executor, noEnums)
      .where({ id: 'u1' })
      .select('displayName')
      .orderBy({ createdAt: -1 })
      .all()
      .toArray();
    const command = commandOf(plans, 0) as { pipeline: readonly unknown[] };
    expect(command.pipeline).toEqual([
      expect.objectContaining({
        filter: MongoFieldFilter.eq(
          '_id',
          new MongoParamRef('u1', { codecId: 'mongo/objectId@1', name: 'id', collection: 'users' }),
        ),
      }),
      expect.objectContaining({ sort: { created_at: -1 } }),
      expect.objectContaining({ projection: { display_name: 1, _id: 0 } }),
    ]);
  });

  it('translates the field of a raw filter expression', async () => {
    const { executor, plans } = recordingExecutor([]);
    await createMongoCollection(contract, 'User', executor, noEnums)
      .where(MongoFieldFilter.eq('home.city', 'London'))
      .all()
      .toArray();
    const command = commandOf(plans, 0) as { pipeline: readonly unknown[] };
    expect(command.pipeline[0]).toEqual(
      expect.objectContaining({
        filter: MongoFieldFilter.eq(
          'home_address.city',
          new MongoParamRef('London', {
            codecId: 'mongo/string@1',
            name: 'home.city',
            collection: 'users',
          }),
        ),
      }),
    );
  });

  it('refuses a stored name passed as a field, naming the field that stores it', () => {
    const { executor } = recordingExecutor();
    expect(() =>
      createMongoCollection(contract, 'User', executor, noEnums).where({ _id: 'u1' } as never),
    ).toThrow(
      expect.objectContaining({
        code: 'ORM.FIELD_UNKNOWN',
        message:
          'Model "User" has no field "_id". "_id" is the stored name of field "id"; pass the field name.',
      }),
    );
  });

  it('writes a create under stored names, applies execution defaults to the stored document, and returns a row', async () => {
    const { executor, plans } = recordingExecutor([{ insertedId: 'u1', document: storedUser }]);
    const row = await createMongoCollection(
      contract,
      'User',
      executor,
      noEnums,
      createdAtDefaults,
    ).create({
      displayName: 'Ada',
      email: null,
      home: { city: 'London' },
      addresses: [{ street: 'Main St', city: 'London' }],
    } as never);
    const command = commandOf(plans, 0) as { document: Record<string, unknown> };
    expect({ keys: Object.keys(command.document).sort(), row }).toEqual({
      keys: ['created_at', 'display_name', 'email', 'home_address', 'user_addresses'],
      row: userRow,
    });
    expect(command.document['user_addresses']).toEqual(
      new MongoParamRef([{ street_name: 'Main St', city: 'London' }]),
    );
  });

  it('updates and upserts under stored names, and refuses a change to the field stored as _id', async () => {
    const { executor, plans } = recordingExecutor([storedUser], [storedUser]);
    const users = createMongoCollection(contract, 'User', executor, noEnums).where({ id: 'u1' });
    const updated = await users.update((u) => [u.displayName.set('Grace')]);
    const upserted = await users.upsert({
      create: { displayName: 'Ada', createdAt: 'now' } as never,
      update: { email: 'a@b.c' },
    });
    expect([
      (commandOf(plans, 0) as { update: unknown }).update,
      Object.keys(
        (commandOf(plans, 1) as { update: Record<string, object> }).update['$setOnInsert'] ?? {},
      ),
      updated,
      upserted,
    ]).toEqual([
      {
        $set: {
          display_name: new MongoParamRef('Grace', {
            codecId: 'mongo/string@1',
            name: 'displayName',
            collection: 'users',
          }),
        },
      },
      ['display_name', 'created_at'],
      userRow,
      userRow,
    ]);
    await expect(users.update({ id: 'u2' } as never)).rejects.toMatchObject({
      code: 'ORM.FIELD_IMMUTABLE',
    });
    await expect(users.update((u) => [u.id.set('u2')])).rejects.toMatchObject({
      code: 'ORM.FIELD_IMMUTABLE',
    });
  });

  it('joins an include on stored names and reads the included documents as rows', async () => {
    const { executor, plans } = recordingExecutor([
      { _id: 'p1', author_id: 'u1', title: 'Hi', author: storedUser },
    ]);
    const rows = await createMongoCollection(contract, 'Post', executor, noEnums)
      .include('author')
      .all()
      .toArray();
    const command = commandOf(plans, 0) as { pipeline: readonly unknown[] };
    expect([command.pipeline[0], rows]).toEqual([
      expect.objectContaining({ localField: 'author_id', foreignField: '_id', as: 'author' }),
      [{ id: 'p1', authorId: 'u1', title: 'Hi', author: userRow }],
    ]);
  });

  it('reads and writes a variant by the stored discriminator and variant field names', async () => {
    const storedBug = { _id: 't1', _kind: 'bug', task_title: 'Crash', bug_severity: 'high' };
    const { executor, plans } = recordingExecutor([storedBug], [storedBug], [{ insertedCount: 1 }]);
    const tasks = createMongoCollection(contract, 'Task', executor, noEnums);
    const read = await tasks.all().toArray();
    const created = await tasks.variant('bug').all().toArray();
    await tasks.variant('bug').createAndCount([{ title: 'Crash', severity: 'high' } as never]);
    const bugRow = { id: 't1', kind: 'bug', title: 'Crash', severity: 'high' };
    expect([
      read,
      created,
      (commandOf(plans, 1) as { pipeline: readonly { filter?: unknown }[] }).pipeline[0]?.filter,
      Object.keys(
        (commandOf(plans, 2) as { documents: Record<string, unknown>[] }).documents[0] ?? {},
      ),
    ]).toEqual([
      [bugRow],
      [bugRow],
      MongoFieldFilter.eq('_kind', new MongoParamRef('bug')),
      ['task_title', 'bug_severity', '_kind'],
    ]);
  });
});
