import { AsyncIterableResult, defineAnnotation } from '@internal/framework-components/runtime';
import { describe, expect, it } from 'vitest';
import {
  modelIdentity,
  type OrmCall,
  ormResults,
  runOrmCall,
  streamOrmCall,
} from '../src/orm-call';
import { createMockRuntime } from './helpers';
import { createActivityRuntime, ormCallHash } from './orm-call-fixtures';

const cache = defineAnnotation<{ ttl: number }>()({ namespace: 'cache', applicableTo: ['read'] });
const annotated = new Map([['cache', cache({ ttl: 60 })]]);

function rowsCall(
  annotations: OrmCall<unknown>['annotations'] = annotated,
): OrmCall<{ id: number }[]> {
  return {
    method: 'all',
    annotations,
    identity: modelIdentity('public', 'User'),
    accepts: ormResults.rows,
  };
}

function valueCall(): OrmCall<number> {
  return {
    method: 'count',
    annotations: undefined,
    identity: modelIdentity('public', 'User'),
    accepts: ormResults.count,
  };
}

function stream<Row>(rows: readonly Row[], failure?: Error): AsyncIterableResult<Row> {
  return new AsyncIterableResult(
    (async function* () {
      yield* rows;
      if (failure) throw failure;
    })(),
  );
}

describe('runOrmCall', () => {
  it('runs on a queryable without an activity source without starting a call', async () => {
    const runtime = createMockRuntime();
    const ran: unknown[] = [];

    const result = await runOrmCall(runtime, valueCall(), async (queryable) => {
      ran.push(queryable);
      return 3;
    });

    expect({ result, ranOnRuntime: ran[0] === runtime }).toEqual({ result: 3, ranOnRuntime: true });
  });

  it('starts an orm-call, runs on its handle and ends it with the result', async () => {
    const { runtime, calls } = createActivityRuntime();
    let ranOnHandle = false;

    const result = await runOrmCall(runtime, valueCall(), async (queryable) => {
      ranOnHandle = queryable !== runtime;
      return 3;
    });

    expect({ result, ranOnHandle, calls }).toEqual({
      result: 3,
      ranOnHandle: true,
      calls: [
        {
          activity: {
            id: 'call-1',
            kind: 'orm-call',
            contentHash: await ormCallHash('count', { namespace: 'public', model: 'User' }),
            annotations: new Map(),
          },
          statements: [],
          transactions: [],
          ended: { outcome: 'succeeded', result: 3 },
        },
      ],
    });
  });

  it('ends the call failed with no result when the terminal throws', async () => {
    const { runtime, calls } = createActivityRuntime();
    const failure = new Error('statement failed');

    await expect(
      runOrmCall(runtime, valueCall(), async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'failed' }]);
  });

  it('returns an intercepted result without running and ends the call with no result', async () => {
    const { runtime, calls } = createActivityRuntime({ intercept: () => ({ result: 7 }) });
    let ran = false;

    const result = await runOrmCall(runtime, valueCall(), async () => {
      ran = true;
      return 3;
    });

    expect({ result, ran, ended: calls.map(({ ended }) => ended) }).toEqual({
      result: 7,
      ran: false,
      ended: [{ outcome: 'succeeded' }],
    });
  });

  it('rejects an intercepted result of the wrong shape and ends the call failed', async () => {
    const { runtime, calls } = createActivityRuntime({ intercept: () => ({ result: 'seven' }) });

    await expect(runOrmCall(runtime, valueCall(), async () => 3)).rejects.toMatchObject({
      code: 'ORM.INTERCEPTED_RESULT_INVALID',
      meta: { method: 'count' },
    });
    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'failed' }]);
  });
});

describe('streamOrmCall', () => {
  it('returns the stream itself on a queryable without an activity source', () => {
    const runtime = createMockRuntime();
    const rows = stream([{ id: 1 }]);

    expect(streamOrmCall(runtime, rowsCall(), () => rows)).toBe(rows);
  });

  it('ends an annotated call succeeded with the rows the caller read', async () => {
    const { runtime, calls } = createActivityRuntime();

    const rows = await streamOrmCall(runtime, rowsCall(), () => stream([{ id: 1 }, { id: 2 }]));

    expect({ rows, calls: calls.map(({ activity, ended }) => ({ activity, ended })) }).toEqual({
      rows: [{ id: 1 }, { id: 2 }],
      calls: [
        {
          activity: expect.objectContaining({ kind: 'orm-call', annotations: annotated }),
          ended: { outcome: 'succeeded', result: [{ id: 1 }, { id: 2 }] },
        },
      ],
    });
  });

  it('does not hold the rows of an unannotated call', async () => {
    const { runtime, calls } = createActivityRuntime();

    await streamOrmCall(runtime, rowsCall(new Map()), () => stream([{ id: 1 }]));

    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'succeeded' }]);
  });

  it('ends the call stopped when the caller stops reading early', async () => {
    const { runtime, calls } = createActivityRuntime();

    for await (const _row of streamOrmCall(runtime, rowsCall(), () =>
      stream([{ id: 1 }, { id: 2 }]),
    )) {
      break;
    }

    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'stopped' }]);
  });

  it('ends the call failed when the stream fails', async () => {
    const { runtime, calls } = createActivityRuntime();
    const failure = new Error('stream failed');

    await expect(
      streamOrmCall(runtime, rowsCall(), () => stream([{ id: 1 }], failure)).toArray(),
    ).rejects.toBe(failure);
    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'failed' }]);
  });

  it('streams intercepted rows without running and ends the call with no result', async () => {
    const { runtime, calls } = createActivityRuntime({
      intercept: () => ({ result: [{ id: 9 }] }),
    });
    let ran = false;

    const rows = await streamOrmCall(runtime, rowsCall(), () => {
      ran = true;
      return stream([{ id: 1 }]);
    });

    expect({ rows, ran, ended: calls.map(({ ended }) => ended) }).toEqual({
      rows: [{ id: 9 }],
      ran: false,
      ended: [{ outcome: 'succeeded' }],
    });
  });

  it('rejects intercepted rows that are not an array', async () => {
    const { runtime, calls } = createActivityRuntime({ intercept: () => ({ result: { id: 9 } }) });

    await expect(
      streamOrmCall(runtime, rowsCall(), () => stream([{ id: 1 }])).toArray(),
    ).rejects.toMatchObject({ code: 'ORM.INTERCEPTED_RESULT_INVALID' });
    expect(calls.map(({ ended }) => ended)).toEqual([{ outcome: 'failed' }]);
  });
});
