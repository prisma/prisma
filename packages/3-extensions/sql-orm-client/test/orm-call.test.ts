import { AsyncIterableResult, defineAnnotation } from '@internal/framework-components/runtime';
import { describe, expect, it } from 'vitest';
import {
  modelHashInput,
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
    hashInput: modelHashInput('public', 'User'),
    accepts: ormResults.rows,
  };
}

function valueCall(): OrmCall<number> {
  return {
    method: 'count',
    annotations: undefined,
    hashInput: modelHashInput('public', 'User'),
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
  it('rejects on a queryable without an activity source, running nothing', async () => {
    const bare = { query: createMockRuntime().query, execute: createMockRuntime().execute };
    let ran = false;

    await expect(
      runOrmCall(bare, valueCall(), async () => {
        ran = true;
        return 3;
      }),
    ).rejects.toMatchObject({ code: 'ORM.ACTIVITY_SOURCE_MISSING', meta: { method: 'count' } });
    expect(ran).toBe(false);
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
            contentHash: expect.any(Function),
            annotations: new Map(),
          },
          statements: [],
          transactions: [],
          ended: { outcome: 'succeeded', result: 3 },
        },
      ],
    });
    expect(await calls[0]!.activity.contentHash()).toBe(
      await ormCallHash('count', { namespace: 'public', model: 'User' }),
    );
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

  it('rejects with the error that failed the call, with the end error as its cause, when ending it also rejects', async () => {
    const endError = new Error('children open');
    const { runtime, calls } = createActivityRuntime({ endRejects: endError });
    const failure = new Error('statement failed');

    await expect(
      runOrmCall(runtime, valueCall(), async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect({ cause: failure.cause, ended: calls.map(({ ended }) => ended) }).toEqual({
      cause: endError,
      ended: [{ outcome: 'failed' }],
    });
  });

  it('keeps the cause the failing error already has when ending the call also rejects', async () => {
    const { runtime } = createActivityRuntime({ endRejects: new Error('children open') });
    const original = new Error('connection reset');
    const failure = new Error('statement failed', { cause: original });

    await expect(
      runOrmCall(runtime, valueCall(), async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(failure.cause).toBe(original);
  });

  it('rejects an invalid intercepted result with its own error when ending the call also rejects', async () => {
    const endError = new Error('hook failed');
    const { runtime } = createActivityRuntime({
      intercept: () => ({ result: 'seven' }),
      endRejects: endError,
    });

    await expect(runOrmCall(runtime, valueCall(), async () => 3)).rejects.toMatchObject({
      code: 'ORM.INTERCEPTED_RESULT_INVALID',
      cause: endError,
    });
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
  it('throws on a queryable without an activity source', () => {
    const bare = { query: createMockRuntime().query, execute: createMockRuntime().execute };

    expect(() => streamOrmCall(bare, rowsCall(), () => stream([{ id: 1 }]))).toThrow(
      expect.objectContaining({ code: 'ORM.ACTIVITY_SOURCE_MISSING' }),
    );
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

  it('rejects with the stream error when ending the failed call also rejects', async () => {
    const { runtime, calls } = createActivityRuntime({ endRejects: new Error('children open') });
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
