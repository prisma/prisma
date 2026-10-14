import type { ContractField } from '@internal/contract/types';
import type { StorageTable } from '@internal/sql-contract/types';
import type {
  CollectionMethodModelView,
  CollectionMethodReceiver,
} from '@internal/sql-relational-core/query-lane-context';
import { describe, expect, it } from 'vitest';
import { pgvectorNearestMethods } from '../src/core/nearest-collection-method';
import pgvectorRuntimeDescriptor from '../src/exports/runtime';

const vector = (length: number): ContractField => ({
  nullable: true,
  type: { kind: 'scalar', codecId: 'pg/vector@1', typeParams: { length } },
});

const post: CollectionMethodModelView = {
  target: 'postgres',
  name: 'Post',
  fields: {
    id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
    embedding: vector(3),
    summaryEmbedding: vector(2),
    history: { ...vector(3), many: { elementNullable: false } },
  },
  relations: {},
  table: { columns: {}, indexes: [], uniques: [], foreignKeys: [] } as unknown as StorageTable,
};

function distanceRecorder() {
  const steps: unknown[] = [];
  const row = {
    embedding: {
      cosineDistance: (to: readonly number[]) => ({
        asc: () => ({ ascending: to }),
        lt: (limit: number) => ({ below: limit, to }),
      }),
    },
  };
  const receiver: CollectionMethodReceiver = {
    where(condition) {
      steps.push({ where: condition(row, { fns: {}, indexes: {} }) });
      return receiver;
    },
    orderBy(order) {
      steps.push({ orderBy: order(row, { fns: {}, indexes: {} }) });
      return receiver;
    },
  };
  return { receiver, steps };
}

describe('the pgvector nearest-neighbour collection methods', () => {
  it('are contributed by the runtime extension descriptor', () => {
    expect(pgvectorRuntimeDescriptor.collectionMethods?.()).toEqual([pgvectorNearestMethods]);
  });

  it('are one per vector field that is not a list, named <field>_nearest', () => {
    expect(Object.keys(pgvectorNearestMethods.methodsFor(post))).toEqual([
      'embedding_nearest',
      'summaryEmbedding_nearest',
    ]);
  });

  it('order by cosine distance to the vector, nearest first', () => {
    const { receiver, steps } = distanceRecorder();
    const nearest = pgvectorNearestMethods.methodsFor(post)['embedding_nearest'];

    const result = nearest?.(receiver, ...([[1, 2, 3]] as never[]));

    expect({ result, steps }).toEqual({
      result: receiver,
      steps: [{ orderBy: { ascending: [1, 2, 3] } }],
    });
  });

  it('keep only the rows within a maximum distance when one is given', () => {
    const { receiver, steps } = distanceRecorder();
    const nearest = pgvectorNearestMethods.methodsFor(post)['embedding_nearest'];

    nearest?.(receiver, ...([[1, 2, 3], 0.5] as never[]));

    expect(steps).toEqual([
      { orderBy: { ascending: [1, 2, 3] } },
      { where: { below: 0.5, to: [1, 2, 3] } },
    ]);
  });
});
