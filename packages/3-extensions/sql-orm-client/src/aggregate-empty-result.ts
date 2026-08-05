import type { AggregateFn } from './types';

/**
 * What an aggregate reads as when there is no row to read at all.
 *
 * SQL answers an empty input set itself — `count` collapses to zero, the rest
 * to null — so this covers only the degenerate case of a result set with no
 * row: an absent aggregate alias, or an include whose envelope never arrived.
 * Zero is a `bigint` because that is what both targets' `count` codecs decode
 * to; a count is a cardinality, and cardinalities are not capped at 2^53.
 */
export function emptyAggregateResult(fn: AggregateFn): bigint | null {
  return fn === 'count' ? 0n : null;
}
