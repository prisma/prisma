/**
 * Where an aggregate's result codec comes from, for every ORM path that needs one.
 *
 * Planning asks so it can stamp the codec on the projected value; decoding asks so it can turn the JSON the database produced back into an application value. Both ask the same registry the same question, so a result cannot be projected under one codec and read under another.
 */

import type { Contract } from '@internal/contract/types';
import type { CodecRef } from '@internal/framework-components/codec';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { SqlAggregateLowering } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import { codecRefForStorageColumn } from '@internal/sql-relational-core/codec-descriptor-registry';
import type { SqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/query-lane-context';

export interface ResolvedAggregate {
  /** The codec the result carries. */
  readonly codec: CodecRef | undefined;
  /** The codec of the value being aggregated, absent for an aggregate over rows. A lowering reads it to render per input where it must. */
  readonly input: CodecRef | undefined;
  /** Builds the expression, where the target declares one; absent means a plain aggregate call. */
  readonly lower: SqlAggregateLowering | undefined;
}

export interface AggregateCodecQuery {
  readonly aggregates: SqlAggregateDescriptorRegistry;
  readonly contract: Contract<SqlStorage>;
  readonly namespaceId: string;
  readonly tableName: string;
  readonly fn: string;
  /** The column being aggregated, absent for an aggregate over rows. */
  readonly column: string | undefined;
}

/**
 * What an aggregate resolves to: the codec its result carries, and the expression the target wants built for it.
 *
 * An aggregate over a column resolves against that column's own codec, so a target that widens `sum` over small integers and preserves it over decimals answers differently per column without the caller knowing either rule. Where a target also needs the result rendered a particular way — a value its driver cannot otherwise carry — the descriptor's lowering says so, and the codec it declared stays the codec regardless.
 */
export function resolveAggregate(query: AggregateCodecQuery): ResolvedAggregate {
  const input = inputCodecRef(query);
  const resolved = query.aggregates.resolve(query.fn, input);
  return { codec: resolved?.output, input, lower: resolved?.lower };
}

/** The codec an aggregate's result carries, or `undefined` when the composed stack declares no overload for it. */
export function resolveAggregateOutputCodec(query: AggregateCodecQuery): CodecRef | undefined {
  return query.aggregates.resolve(query.fn, inputCodecRef(query))?.output;
}

/** The codec of the value being aggregated — the column's own, or none where the aggregate is over rows. */
function inputCodecRef(query: AggregateCodecQuery): CodecRef | undefined {
  return query.column === undefined
    ? undefined
    : codecRefForStorageColumn(
        query.contract.storage,
        query.namespaceId,
        query.tableName,
        query.column,
      );
}
