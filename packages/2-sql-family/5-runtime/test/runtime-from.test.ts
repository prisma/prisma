import { describe, expect, it, vi } from 'vitest';
import { lazyActivitySource } from '../src/activity-handle';
import { runtimeFrom } from '../src/runtime-from';
import { affectedCountPlan, rowsPlan, setup } from './closed-runtime-stub';

const failure = new Error('client is closed');
const fail = (): never => {
  throw failure;
};

describe('runtimeFrom', () => {
  it('looks up the runtime when a member is called, not when its result is read', async () => {
    const { runtime } = setup();
    const getRuntime = vi.fn(() => runtime);
    const work = runtimeFrom(getRuntime);

    const rows = work.query(rowsPlan());
    const lookupsAtCall = getRuntime.mock.calls.length;
    await rows.toArray();

    expect({ lookupsAtCall, lookups: getRuntime.mock.calls.length }).toEqual({
      lookupsAtCall: 1,
      lookups: 1,
    });
  });

  it.each([
    ['query', () => runtimeFrom(fail).query(rowsPlan()).toArray()],
    ['execute', () => runtimeFrom(fail).execute(affectedCountPlan())],
    ['connection', () => runtimeFrom(fail).connection()],
    ['prepare', () => runtimeFrom(fail).prepare({}, () => rowsPlan())],
  ])(
    '%s rejects with the lookup failure instead of throwing at the call',
    async (_member, call) => {
      let result: Promise<unknown> | undefined;
      expect(() => {
        result = call();
      }).not.toThrow();

      await expect(result).rejects.toBe(failure);
    },
  );
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
