/**
 * Representative application values for every built-in PostgreSQL codec
 * descriptor, exercised against a real database by the conformance suite.
 *
 * `notYetCanonical` marks a case whose projection disagrees with the codec's
 * **current** `encodeJson` / `decodeJson` — the projection will not execute, or
 * the parsed value differs from what `encodeJson` produces, or the value does
 * not survive the round trip back. The suite asserts a marked case still fails
 * and still fails the recorded way, so a projection cannot be brought into
 * agreement without updating this file.
 *
 * This file therefore does not enumerate every codec whose JSON is not yet
 * canonical. Both conformance conditions are stated against the codec's own two
 * methods, so a codec whose `encodeJson` is itself not canonical conforms here:
 * its projection faithfully realizes a representation that is simply not the one
 * the codec ends up with. `pg/bytea@1` (PostgreSQL hex, where the canonical form
 * is base64) and the PostgreSQL temporals are in that position — they conform
 * today and transit through a failing state as their canonical form lands.
 * Which codecs still owe a canonical form is tracked by the plan, not by this
 * file.
 */

import type { PostgresCodecConformanceCase } from './harness';

const ENUM_TYPE = 'codec_conformance_mood';

/**
 * A session whose temporal settings all differ from the defaults. A temporal
 * case that passes under it renders from the stored value alone rather than
 * inheriting whatever the connected session happens to be set to.
 */
const HOSTILE_TEMPORAL_SESSION: readonly string[] = [
  "SET TimeZone = 'Asia/Kolkata'",
  "SET DateStyle = 'German, DMY'",
  "SET IntervalStyle = 'sql_standard'",
];

export const postgresConformanceCases: readonly PostgresCodecConformanceCase[] = [
  { codecId: 'sql/char@1', label: 'single character', value: 'a' },
  { codecId: 'sql/varchar@1', label: 'text', value: 'hello' },
  { codecId: 'sql/int@1', label: 'integer', value: 42 },
  { codecId: 'sql/float@1', label: 'finite float', value: 1.5 },
  { codecId: 'sql/text@1', label: 'text', value: 'hello' },
  { codecId: 'sql/timestamp@1', label: 'instant', value: new Date('2026-01-02T03:04:05.678Z') },
  {
    codecId: 'sql/timestamp@1',
    label: 'instant under a hostile session',
    value: new Date('2026-01-02T03:04:05.678Z'),
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  { codecId: 'pg/text@1', label: 'text', value: 'hello' },
  {
    codecId: 'pg/enum@1',
    label: 'member value',
    value: 'content',
    typeParams: { typeName: ENUM_TYPE },
    setupSql: [
      `DROP TYPE IF EXISTS "${ENUM_TYPE}"`,
      `CREATE TYPE "${ENUM_TYPE}" AS ENUM ('sad', 'content', 'happy')`,
    ],
  },
  { codecId: 'pg/char@1', label: 'single character', value: 'a' },
  { codecId: 'pg/varchar@1', label: 'text', value: 'hello' },
  { codecId: 'pg/int@1', label: 'integer', value: 42 },
  { codecId: 'pg/float@1', label: 'finite float', value: 1.5 },
  { codecId: 'pg/int4@1', label: 'integer', value: 42 },
  { codecId: 'pg/int2@1', label: 'small integer', value: 7 },
  { codecId: 'pg/int8@1', label: 'largest safe integer', value: 9007199254740991n },
  { codecId: 'pg/int8@1', label: 'integer beyond double precision', value: 9007199254740993n },
  { codecId: 'pg/int8@1', label: 'int8 lower bound', value: -9223372036854775808n },
  { codecId: 'pg/float4@1', label: 'finite float', value: 1.5 },
  { codecId: 'pg/float8@1', label: 'finite float', value: 1.5 },
  { codecId: 'pg/numeric@1', label: 'representable decimal', value: '1.5' },
  { codecId: 'pg/numeric@1', label: 'integer beyond double precision', value: '9007199254740993' },
  {
    codecId: 'pg/numeric@1',
    label: 'twenty fractional digits',
    value: '1234567890.12345678901234567890',
  },
  { codecId: 'pg/bool@1', label: 'true', value: true },
  { codecId: 'pg/bit@1', label: 'single bit', value: '1' },
  { codecId: 'pg/varbit@1', label: 'bit string', value: '1010' },
  { codecId: 'pg/bytea@1', label: 'byte string', value: new Uint8Array([0, 1, 255]) },
  { codecId: 'pg/date@1', label: 'calendar date', value: new Date(Date.UTC(2026, 0, 2)) },
  {
    codecId: 'pg/timestamp@1',
    label: 'instant with milliseconds',
    value: new Date('2026-01-02T03:04:05.678Z'),
  },
  {
    codecId: 'pg/timestamp@1',
    label: 'instant under a hostile session',
    value: new Date('2026-01-02T03:04:05.678Z'),
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  {
    codecId: 'pg/timestamptz@1',
    label: 'instant with milliseconds',
    value: new Date('2026-01-02T03:04:05.678Z'),
  },
  {
    codecId: 'pg/timestamptz@1',
    label: 'instant under a hostile session',
    value: new Date('2026-01-02T03:04:05.678Z'),
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  {
    codecId: 'pg/date@1',
    label: 'calendar date under a hostile session',
    value: new Date(Date.UTC(2026, 0, 2)),
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  { codecId: 'pg/time@1', label: 'time of day', value: '03:04:05' },
  {
    codecId: 'pg/time@1',
    label: 'time of day under a hostile session',
    value: '03:04:05',
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  { codecId: 'pg/timetz@1', label: 'time of day at UTC', value: '03:04:05+00' },
  {
    codecId: 'pg/timetz@1',
    label: 'time of day at UTC under a hostile session',
    value: '03:04:05+00',
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  { codecId: 'pg/interval@1', label: 'day interval', value: '1 day' },
  {
    codecId: 'pg/interval@1',
    label: 'day interval under a hostile session',
    value: '1 day',
    setupSql: HOSTILE_TEMPORAL_SESSION,
    notYetCanonical: {
      kind: 'mismatch',
      reason:
        "an interval is rendered in the session's IntervalStyle, and the codec carries an opaque string whose own syntax is undecided, so there is no form for a projection to pin it to yet",
    },
  },
  { codecId: 'pg/json@1', label: 'document', value: { a: 1, b: ['x'] } },
  { codecId: 'pg/jsonb@1', label: 'document', value: { a: 1, b: ['x'] } },
  {
    codecId: 'pg/uuid@1',
    label: 'uuid',
    value: '123e4567-e89b-12d3-a456-426614174000',
  },
  { codecId: 'pg/inet@1', label: 'ipv4 address', value: '192.168.0.1' },
  { codecId: 'pg/text-array@1', label: 'string array', value: ['a', 'b'] },
];
