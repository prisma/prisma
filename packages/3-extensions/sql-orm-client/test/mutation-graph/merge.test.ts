import { describe, expect, it } from 'vitest';
import { Merge } from '../../src/mutation-graph/merge';
import { recordingRun } from './statements';

describe('Merge', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(new Merge())).toBe(true);
  });

  it('makes one row from the first row of each side, side by side, without a statement', async () => {
    const run = recordingRun();

    const rows = await new Merge().execute(
      {
        left: [{ id: 7, name: 'Ada', type: 'feature' }],
        right: [{ features__priority: 3 }],
      },
      run,
    );

    expect(rows).toEqual([{ id: 7, name: 'Ada', type: 'feature', features__priority: 3 }]);
    expect(run.queried).toEqual([]);
    expect(run.executed).toEqual([]);
  });

  it('gives no row when a side has no row', async () => {
    const merge = new Merge();
    const run = recordingRun();

    expect(await merge.execute({ left: [], right: [{ features__priority: 3 }] }, run)).toEqual([]);
    expect(await merge.execute({ left: [{ id: 7 }], right: [] }, run)).toEqual([]);
  });
});
