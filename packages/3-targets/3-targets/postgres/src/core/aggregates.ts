/**
 * PostgreSQL's built-in aggregate result matrix, as descriptors.
 *
 * Every row here was read off a live PostgreSQL 17 (`pg_typeof(<aggregate>(<column>))` over a column of each built-in codec's native type), not inferred from the input codec's traits — which is the point, since PostgreSQL's own rules are neither uniform nor guessable from the input alone: `sum` over the small integers widens to `bigint` but over `bigint` goes to `numeric`; `avg` over `real` widens to `double precision` while `sum` over `real` stays `real`; `sum` and `avg` over `time` produce an `interval`; `min`/`max` over `varchar` produce `text`.
 *
 * The pairs PostgreSQL does not aggregate at all — `sum`/`avg` over anything non-numeric and non-temporal, and `min`/`max` over `bool`, `uuid`, `bytea`, `bit`, `bit varying`, `json`, and `jsonb` — carry no descriptor, so resolution reports them as unavailable rather than typing a result for an expression the database refuses to run.
 *
 * Result identity is declared, not lowered: PostgreSQL's native result types already are these codecs' native types, so no descriptor needs a lowering hook.
 */

import type { CodecTrait } from '@internal/framework-components/codec';
import type { ValueInputAggregateDescriptor } from '@internal/framework-components/components';
import type { SqlAggregateDescriptor } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import {
  PG_DATE_CODEC_ID,
  PG_FLOAT_CODEC_ID,
  PG_FLOAT4_CODEC_ID,
  PG_FLOAT8_CODEC_ID,
  PG_INET_CODEC_ID,
  PG_INT_CODEC_ID,
  PG_INT2_CODEC_ID,
  PG_INT4_CODEC_ID,
  PG_INT8_CODEC_ID,
  PG_INTERVAL_CODEC_ID,
  PG_NUMERIC_CODEC_ID,
  PG_TEXT_ARRAY_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_TIME_CODEC_ID,
  PG_TIMESTAMP_CODEC_ID,
  PG_TIMESTAMPTZ_CODEC_ID,
  PG_TIMETZ_CODEC_ID,
  PG_VARCHAR_CODEC_ID,
  SQL_FLOAT_CODEC_ID,
  SQL_INT_CODEC_ID,
  SQL_TIMESTAMP_CODEC_ID,
  SQL_VARCHAR_CODEC_ID,
} from './codec-ids';

/** The input matches available to an overload that consumes a value — the only ones these helpers build, since every aggregate here but `count` needs something to fold. */
type ValueInput = ValueInputAggregateDescriptor['input'];

const overCodec = (codecId: string): ValueInput => ({ kind: 'codec', codecId });
const overTrait = (trait: CodecTrait): ValueInput => ({ kind: 'trait', trait });

/**
 * An aggregate whose result is one of the input values, so it carries the input's codec — type parameters included, since a `numeric(10,3)` minimum is still a `numeric(10,3)`.
 */
const preservesInput = (operation: string, input: ValueInput): SqlAggregateDescriptor => ({
  operation,
  input,
  output: { kind: 'self' },
  nullable: true,
});

/**
 * An aggregate whose result is a new value. It names its result codec without type parameters: a sum leaves the input's width behind (a `numeric(10,3)` column sums to an unconstrained `numeric`), so carrying the input's parameters into the result would understate the range.
 */
const produces = (
  operation: string,
  input: ValueInput,
  codecId: string,
): SqlAggregateDescriptor => ({
  operation,
  input,
  output: { kind: 'codec', codecId },
  nullable: true,
});

/** Integer codecs whose `sum` widens to `bigint` — every built-in integer bar `int8`, whose sum goes to `numeric` instead. */
const SUM_WIDENS_TO_INT8 = [
  PG_INT2_CODEC_ID,
  PG_INT4_CODEC_ID,
  PG_INT_CODEC_ID,
  SQL_INT_CODEC_ID,
] as const;

/** Every built-in integer codec: `avg` over any of them is `numeric`. */
const AVG_IS_NUMERIC = [...SUM_WIDENS_TO_INT8, PG_INT8_CODEC_ID] as const;

/** Codecs over `double precision`, whose `sum` and `avg` stay there. */
const DOUBLE_PRECISION_CODECS = [
  PG_FLOAT8_CODEC_ID,
  PG_FLOAT_CODEC_ID,
  SQL_FLOAT_CODEC_ID,
] as const;

/**
 * Codecs whose `min`/`max` returns the input type and whose traits do not already say so: the temporal types, `inet`, and `text[]` advertise `order` or `equality`, which `uuid`, `bit`, `bit varying`, `bool`, `bytea`, `json`, and `jsonb` also advertise while having no `min`/`max` at all. An exact overload per supported codec is therefore the only honest shape — a trait fallback over `order` would claim the unsupported ones too.
 */
const MIN_MAX_PRESERVING_CODECS = [
  PG_DATE_CODEC_ID,
  PG_TIMESTAMP_CODEC_ID,
  SQL_TIMESTAMP_CODEC_ID,
  PG_TIMESTAMPTZ_CODEC_ID,
  PG_TIME_CODEC_ID,
  PG_TIMETZ_CODEC_ID,
  PG_INTERVAL_CODEC_ID,
  PG_INET_CODEC_ID,
  PG_TEXT_ARRAY_CODEC_ID,
] as const;

/**
 * `min`/`max` over the character types, where the trait rung does hold: every `textual` codec returns its input type — except the two `varchar` codecs, whose result PostgreSQL widens to `text`, and which therefore claim themselves exactly and shadow the fallback.
 */
const MIN_MAX_WIDENS_TO_TEXT = [PG_VARCHAR_CODEC_ID, SQL_VARCHAR_CODEC_ID] as const;

const orderingDescriptors = (operation: 'min' | 'max'): ReadonlyArray<SqlAggregateDescriptor> => [
  preservesInput(operation, overTrait('numeric')),
  preservesInput(operation, overTrait('textual')),
  ...MIN_MAX_WIDENS_TO_TEXT.map((codecId) =>
    produces(operation, overCodec(codecId), PG_TEXT_CODEC_ID),
  ),
  ...MIN_MAX_PRESERVING_CODECS.map((codecId) => preservesInput(operation, overCodec(codecId))),
];

/**
 * Every aggregate overload the PostgreSQL target contributes. The adapter lists these on `types.aggregateDescriptors`, from where emission derives result types and the runtime builds its resolution registry.
 */
export const postgresAggregateDescriptors: ReadonlyArray<SqlAggregateDescriptor> = [
  // `count` returns `bigint` whether it counts entries or non-null values, which is what makes it input-agnostic rather than merely input-less.
  {
    operation: 'count',
    input: { kind: 'any' },
    output: { kind: 'codec', codecId: PG_INT8_CODEC_ID },
    nullable: false,
  },

  ...SUM_WIDENS_TO_INT8.map((codecId) => produces('sum', overCodec(codecId), PG_INT8_CODEC_ID)),
  produces('sum', overCodec(PG_INT8_CODEC_ID), PG_NUMERIC_CODEC_ID),
  produces('sum', overCodec(PG_FLOAT4_CODEC_ID), PG_FLOAT4_CODEC_ID),
  ...DOUBLE_PRECISION_CODECS.map((codecId) =>
    produces('sum', overCodec(codecId), PG_FLOAT8_CODEC_ID),
  ),
  produces('sum', overCodec(PG_NUMERIC_CODEC_ID), PG_NUMERIC_CODEC_ID),
  produces('sum', overCodec(PG_INTERVAL_CODEC_ID), PG_INTERVAL_CODEC_ID),
  produces('sum', overCodec(PG_TIME_CODEC_ID), PG_INTERVAL_CODEC_ID),

  ...AVG_IS_NUMERIC.map((codecId) => produces('avg', overCodec(codecId), PG_NUMERIC_CODEC_ID)),
  ...[PG_FLOAT4_CODEC_ID, ...DOUBLE_PRECISION_CODECS].map((codecId) =>
    produces('avg', overCodec(codecId), PG_FLOAT8_CODEC_ID),
  ),
  produces('avg', overCodec(PG_NUMERIC_CODEC_ID), PG_NUMERIC_CODEC_ID),
  produces('avg', overCodec(PG_INTERVAL_CODEC_ID), PG_INTERVAL_CODEC_ID),
  produces('avg', overCodec(PG_TIME_CODEC_ID), PG_INTERVAL_CODEC_ID),

  ...orderingDescriptors('min'),
  ...orderingDescriptors('max'),
];
