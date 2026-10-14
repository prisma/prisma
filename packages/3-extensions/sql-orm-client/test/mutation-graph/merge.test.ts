import { describe, expect, it } from 'vitest';
import { Merge } from '../../src/mutation-graph/merge';
import { aliasedTable, recordingRun } from './statements';

const variantTable = aliasedTable('posts');

describe('Merge', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(new Merge(variantTable, ['id']))).toBe(true);
  });

  it('makes one row from the base row and the variant row, as the variant create on main does', async () => {
    const run = recordingRun();

    const rows = await new Merge(variantTable, ['id']).execute(
      {
        base: [[{ id: 7, name: 'Ada', type: 'feature' }]],
        variant: [[{ id: 7, title: 'Hello', views: 3 }]],
      },
      run,
    );

    expect(rows).toEqual([
      { id: 7, name: 'Ada', type: 'feature', posts__title: 'Hello', posts__views: 3 },
    ]);
    expect(run.queried).toEqual([]);
    expect(run.executed).toEqual([]);
  });

  it('gives no row when either input has no row', async () => {
    const merge = new Merge(variantTable, ['id']);
    const run = recordingRun();

    expect(await merge.execute({ base: [[]], variant: [[{ id: 7 }]] }, run)).toEqual([]);
    expect(await merge.execute({ base: [[{ id: 7 }]], variant: [[]] }, run)).toEqual([]);
  });

  it('returns no column of its own and is unchanged when asked to return more', () => {
    const merge = new Merge(variantTable, ['id']);

    expect(merge.returns).toEqual([]);
    expect(merge.withReturning([])).toBe(merge);
  });
});
