import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { ParadeDbProximityChain } from '../src/core/proximity-chain';
import paradedbDescriptor from '../src/exports/runtime';

const operations = paradedbDescriptor.queryOperations?.() ?? {};

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected fn to throw');
}

describe('paradedb structured error codes', () => {
  it('PARADEDB.ARGUMENT_INVALID on paradeDbFuzzy with an out-of-range distance', () => {
    const op = operations['paradeDbFuzzy'];
    if (!op) throw new Error('paradeDbFuzzy not found');
    const err = catchError(() => op.impl('term' as never, 3 as never));
    expect(isStructuredError(err)).toBe(true);
    expect(err).toMatchObject({
      code: 'PARADEDB.ARGUMENT_INVALID',
      message: 'paradeDbFuzzy: distance must be an integer in [0, 2]; got 3',
      meta: { helper: 'paradeDbFuzzy', argument: 'distance', received: 3 },
    });
  });

  it('PARADEDB.ARGUMENT_INVALID on paradeDbBoost with a non-integer weight', () => {
    const op = operations['paradeDbBoost'];
    if (!op) throw new Error('paradeDbBoost not found');
    const err = catchError(() => op.impl('term' as never, 1.5 as never));
    expect(isStructuredError(err)).toBe(true);
    expect(err).toMatchObject({
      code: 'PARADEDB.ARGUMENT_INVALID',
      meta: { helper: 'paradeDbBoost', argument: 'weight', received: 1.5 },
    });
  });

  it('PARADEDB.ARGUMENT_INVALID on proximity within with a negative distance', () => {
    const chain = new ParadeDbProximityChain('start');
    const err = catchError(() => chain.within(-1, 'x'));
    expect(isStructuredError(err)).toBe(true);
    expect(err).toMatchObject({
      code: 'PARADEDB.ARGUMENT_INVALID',
      message: 'paradeDbProximity.within: distance must be a non-negative integer; got -1',
      meta: { helper: 'paradeDbProximity.within', argument: 'distance', received: -1 },
    });
  });

  it('PARADEDB.ARGUMENT_INVALID on building a proximity chain with no within step', () => {
    const chain = new ParadeDbProximityChain('start');
    const err = catchError(() => chain.buildAst());
    expect(isStructuredError(err)).toBe(true);
    expect(err).toMatchObject({
      code: 'PARADEDB.ARGUMENT_INVALID',
      message: 'paradeDbProximity: chain must have at least one .within(distance, term) step',
    });
  });
});
