/**
 * SQLite's built-in aggregate result matrix, as descriptors.
 *
 * Every row was read off a live SQLite 3.53 (`typeof(<aggregate>(<column>))` over a column of each built-in codec's storage type). SQLite types values, not columns, so what a probe reports is the storage class of the aggregate's result: `sum` over integers stays `integer`, `sum` over reals is `real`, `avg` is `real` for every input, and `min`/`max` return a value of the input's own class.
 *
 * Two SQLite behaviours shape which pairs get a descriptor at all:
 *
 * - **`sum` of integers does not widen.** An `INTEGER` sum that exceeds a 64-bit integer raises `integer overflow` rather than promoting to a float, so the result is an integer or it is nothing. It is declared as `sqlite/bigint@1` and not `sqlite/integer@1`: a sum of small integers is free to exceed 2^53 while remaining a perfectly good SQLite integer, and only the bigint codec carries such a value into the application without rounding.
 * - **`sum` and `avg` coerce rather than refuse.** Over `TEXT` or `BLOB`, SQLite reads a leading number where it can and 0 otherwise, so `sum` over a column of words is `0.0` and over a column of numerals is their total — a result whose very storage class depends on the rows. No descriptor claims those pairs: an aggregate whose result cannot be typed from the schema is one this target declines to offer, and the conformance suite pins the list of pairs left unclaimed for that reason.
 *
 * Result identity is declared, not lowered: SQLite's own results already carry these codecs' storage classes, so no descriptor needs a lowering hook.
 */

import type { CodecTrait } from '@prisma-next/framework-components/codec';
import type { ValueInputAggregateDescriptor } from '@prisma-next/framework-components/components';
import type { SqlAggregateDescriptor } from '@prisma-next/sql-relational-core/aggregate-descriptor-registry';
import {
  SQL_FLOAT_CODEC_ID,
  SQL_INT_CODEC_ID,
  SQLITE_BIGINT_CODEC_ID,
  SQLITE_BLOB_CODEC_ID,
  SQLITE_DATETIME_CODEC_ID,
  SQLITE_INTEGER_CODEC_ID,
  SQLITE_JSON_CODEC_ID,
  SQLITE_REAL_CODEC_ID,
} from './codec-ids';

/** The input matches available to an overload that consumes a value — the only ones these helpers build, since every aggregate here but `count` needs something to fold. */
type ValueInput = ValueInputAggregateDescriptor['input'];

const overCodec = (codecId: string): ValueInput => ({ kind: 'codec', codecId });
const overTrait = (trait: CodecTrait): ValueInput => ({ kind: 'trait', trait });

/** An aggregate whose result is one of the input values, so it carries the input's codec. */
const preservesInput = (operation: string, input: ValueInput): SqlAggregateDescriptor => ({
  operation,
  input,
  output: { kind: 'self' },
  nullable: true,
});

/** An aggregate whose result is a new value, named by codec and without the input's type parameters. */
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

/** Codecs stored as SQLite integers. Their `sum` is an integer of up to 64 bits, which is `sqlite/bigint@1`'s range and beyond `sqlite/integer@1`'s. */
const INTEGER_CODECS = [SQLITE_INTEGER_CODEC_ID, SQLITE_BIGINT_CODEC_ID, SQL_INT_CODEC_ID] as const;

/** Codecs stored as SQLite reals. Their `sum` stays real. */
const REAL_CODECS = [SQLITE_REAL_CODEC_ID, SQL_FLOAT_CODEC_ID] as const;

/**
 * Codecs whose `min`/`max` returns the input value and whose traits do not already say so: SQLite compares blobs bytewise and text by its collation, so a datetime, a JSON document, and a blob each have a well-defined least and greatest — unlike the numeric and textual codecs, whose traits carry them.
 */
const MIN_MAX_PRESERVING_CODECS = [
  SQLITE_DATETIME_CODEC_ID,
  SQLITE_JSON_CODEC_ID,
  SQLITE_BLOB_CODEC_ID,
] as const;

const orderingDescriptors = (operation: 'min' | 'max'): ReadonlyArray<SqlAggregateDescriptor> => [
  preservesInput(operation, overTrait('numeric')),
  preservesInput(operation, overTrait('textual')),
  ...MIN_MAX_PRESERVING_CODECS.map((codecId) => preservesInput(operation, overCodec(codecId))),
];

/**
 * Every aggregate overload the SQLite target contributes. The adapter lists these on `types.codecTypes.aggregateDescriptors`, from where emission derives result types and the runtime builds its resolution registry.
 */
export const sqliteAggregateDescriptors: ReadonlyArray<SqlAggregateDescriptor> = [
  // `count` returns an integer whether it counts rows or non-null values, which is what makes it input-agnostic rather than merely input-less. Counts are unbounded in principle, so they carry the bigint codec.
  {
    operation: 'count',
    input: { kind: 'any' },
    output: { kind: 'codec', codecId: SQLITE_BIGINT_CODEC_ID },
    nullable: false,
  },

  ...INTEGER_CODECS.map((codecId) => produces('sum', overCodec(codecId), SQLITE_BIGINT_CODEC_ID)),
  ...REAL_CODECS.map((codecId) => produces('sum', overCodec(codecId), SQLITE_REAL_CODEC_ID)),

  // `avg` is real for every input, integers included.
  ...[...INTEGER_CODECS, ...REAL_CODECS].map((codecId) =>
    produces('avg', overCodec(codecId), SQLITE_REAL_CODEC_ID),
  ),

  ...orderingDescriptors('min'),
  ...orderingDescriptors('max'),
];
