import type { StorageTable } from '@internal/sql-contract/types';
import type {
  CollectionMethodModelView,
  CollectionMethodReceiver,
  CollectionMethodTools,
} from '@internal/sql-relational-core/query-lane-context';
import { describe, expect, it } from 'vitest';
import { postgresFullTextMethods } from '../src/core/full-text-collection-method';
import postgresRuntimeTargetDescriptor from '../src/exports/runtime';

function recordingReceiver(tools: CollectionMethodTools) {
  const calls: Array<{ readonly method: string; readonly result: unknown }> = [];
  const receiver: CollectionMethodReceiver = {
    where(condition) {
      calls.push({ method: 'where', result: condition(undefined, tools) });
      return receiver;
    },
    orderBy(order) {
      calls.push({ method: 'orderBy', result: order(undefined, tools) });
      return receiver;
    },
  };
  return { receiver, calls };
}

function model(target: string, indexes: StorageTable['indexes']): CollectionMethodModelView {
  return {
    target,
    name: 'Post',
    fields: {},
    relations: {},
    table: { columns: {}, indexes, uniques: [], foreignKeys: [] } as unknown as StorageTable,
  };
}

const indexes = [
  { name: 'post_search_1', prefix: 'post_search', columns: ['title'], type: 'fullText' },
  { name: 'post_title', columns: ['title'] },
  { name: 'shared_a', prefix: 'shared', columns: ['title'], type: 'fullText' },
  { name: 'shared_b', prefix: 'shared', columns: ['body'], type: 'fullText' },
] as unknown as StorageTable['indexes'];

describe('the Postgres full-text collection methods', () => {
  it('are contributed by the runtime target descriptor', () => {
    expect(postgresRuntimeTargetDescriptor.collectionMethods()).toEqual([postgresFullTextMethods]);
  });

  it('name one method after each full-text index whose authored name is its own, for Postgres only', () => {
    expect({
      postgres: Object.keys(postgresFullTextMethods.methodsFor(model('postgres', indexes))),
      other: Object.keys(postgresFullTextMethods.methodsFor(model('other', indexes))),
    }).toEqual({ postgres: ['post_search'], other: [] });
  });

  it('filters with fullTextMatches and then orders by fullTextRank, descending', () => {
    const index = { columns: {}, type: 'fullText', options: undefined };
    const tools: CollectionMethodTools = {
      indexes: { post_search: index },
      fns: {
        fullTextMatches: (i: unknown, q: unknown) => ({ matches: [i, q] }),
        fullTextRank: (i: unknown, q: unknown) => ({ desc: () => ({ rankDesc: [i, q] }) }),
      },
    };
    const { receiver, calls } = recordingReceiver(tools);
    const method = postgresFullTextMethods.methodsFor(model('postgres', indexes))['post_search'];

    const result = method?.(receiver, 'q' as never);

    expect({ result, calls }).toEqual({
      result: receiver,
      calls: [
        { method: 'where', result: { matches: [index, 'q'] } },
        { method: 'orderBy', result: { rankDesc: [index, 'q'] } },
      ],
    });
  });
});
