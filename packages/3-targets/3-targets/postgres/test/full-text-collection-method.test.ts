import type {
  CollectionMethodReceiver,
  CollectionMethodTools,
} from '@internal/sql-relational-core/query-lane-context';
import { describe, expect, it } from 'vitest';
import { postgresFullTextMethod } from '../src/core/full-text-collection-method';
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

describe('the Postgres full-text collection method', () => {
  it('is contributed by the runtime target descriptor', () => {
    expect(postgresRuntimeTargetDescriptor.collectionMethods()).toEqual([postgresFullTextMethod]);
  });

  it('matches full-text indexes only', () => {
    expect({
      fullText: postgresFullTextMethod.matches({ name: 'a', type: 'fullText' }),
      btree: postgresFullTextMethod.matches({ name: 'b' }),
      other: postgresFullTextMethod.matches({ name: 'c', type: 'gin' }),
    }).toEqual({ fullText: true, btree: false, other: false });
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

    const result = postgresFullTextMethod.method(receiver, 'post_search', 'q' as never);

    expect({ result, calls }).toEqual({
      result: receiver,
      calls: [
        { method: 'where', result: { matches: [index, 'q'] } },
        { method: 'orderBy', result: { rankDesc: [index, 'q'] } },
      ],
    });
  });
});
