import { describe, expect, it } from 'vitest';
import { ConcatRows } from '../../src/mutation-graph/concat-rows';
import { recordingRun } from './statements';

describe('ConcatRows', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(new ConcatRows())).toBe(true);
  });

  it('gives all rows of its inputs, one input after another, without a statement', async () => {
    const run = recordingRun();

    const rows = await new ConcatRows().execute(
      { rows: [[{ id: 1 }, { id: 2 }], [], [{ id: 3 }]] },
      run,
    );

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(run.queried).toEqual([]);
    expect(run.executed).toEqual([]);
  });

  it('gives no row when the slot has no edge', async () => {
    expect(await new ConcatRows().execute({ rows: null }, recordingRun())).toEqual([]);
  });

  it('returns no column of its own and is unchanged when asked to return more', () => {
    const concat = new ConcatRows();

    expect(concat.returns).toEqual([]);
    expect(concat.withReturning([])).toBe(concat);
  });
});
