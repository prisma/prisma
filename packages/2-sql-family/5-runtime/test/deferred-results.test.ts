import { describe, expect, it } from 'vitest';
import { lazyActivitySource } from '../src/activity-handle';
import { deferPromise, deferRows } from '../src/deferred-results';

const failure = new Error('not connected');
const fail = (): never => {
  throw failure;
};

describe('deferRows', () => {
  it('rejects the read instead of throwing at the call when its rows cannot be opened', async () => {
    const rows = deferRows(fail);

    await expect(rows.toArray()).rejects.toBe(failure);
  });

  it('reads the rows it is given', async () => {
    async function* two() {
      yield 1;
      yield 2;
    }

    await expect(deferRows(two).toArray()).resolves.toEqual([1, 2]);
  });
});

describe('deferPromise', () => {
  it('rejects instead of throwing at the call when its work throws', async () => {
    await expect(deferPromise(fail)).rejects.toBe(failure);
  });
});

describe('lazyActivitySource', () => {
  it('rejects instead of throwing at the call when its source cannot be found', async () => {
    const source = lazyActivitySource(fail);

    await expect(
      source.startActivity({ kind: 'orm-call', contentHash: async () => 'hash' } as never),
    ).rejects.toBe(failure);
    await expect(source.planContentHash({} as never)).rejects.toBe(failure);
  });
});
