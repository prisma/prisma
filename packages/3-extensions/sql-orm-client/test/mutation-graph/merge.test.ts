import { describe, expect, it } from 'vitest';
import { Merge } from '../../src/mutation-graph/merge';
import { recordingRun } from './statements';

describe('Merge', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(new Merge())).toBe(true);
  });

  it('makes one row from one row of each input, side by side, without a statement', async () => {
    const run = recordingRun();

    const rows = await new Merge().execute(
      {
        rows: [[{ id: 7, name: 'Ada', type: 'feature' }], [{ features__priority: 3 }]],
      },
      run,
    );

    expect(rows).toEqual([{ id: 7, name: 'Ada', type: 'feature', features__priority: 3 }]);
    expect(run.queried).toEqual([]);
    expect(run.executed).toEqual([]);
  });

  it('gives no row when an input has no row or the slot has no edge', async () => {
    const merge = new Merge();
    const run = recordingRun();

    expect(await merge.execute({ rows: [[], [{ features__priority: 3 }]] }, run)).toEqual([]);
    expect(await merge.execute({ rows: [[{ id: 7 }], []] }, run)).toEqual([]);
    expect(await merge.execute({ rows: null }, run)).toEqual([]);
  });

  it('returns no column of its own and is unchanged when asked to return more', () => {
    const merge = new Merge();

    expect(merge.returns).toEqual([]);
    expect(merge.withReturning([])).toBe(merge);
  });
});
