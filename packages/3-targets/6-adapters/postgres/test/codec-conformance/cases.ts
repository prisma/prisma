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
 * A green run is therefore not a claim that every codec's JSON is canonical.
 * Both conditions are measured against the codec's own two methods, so a codec
 * whose `encodeJson` is itself not canonical conforms here: its projection
 * faithfully realizes a representation that is simply not the one the codec ends
 * up with. Such a codec conforms, then transits through a failing state when its
 * canonical form lands, then conforms again.
 *
 * Which codecs are in that position is deliberately not listed here — that list
 * lives in the plan, and a copy of it in this header would go stale every time
 * one of them landed. What this file names is narrower and self-maintaining: the
 * cases that fail *today*, each carrying its own `notYetCanonical` reason.
 *
 * A case is only as good as the boundary it crosses. A value chosen for being
 * typical is the one least likely to expose a format defect — see the base64
 * line-break cases below, where the small value could not have caught it.
 */

import type { PostgresCodecConformanceCase } from './harness';

const ENUM_TYPE = 'codec_conformance_mood';

/**
 * A session whose temporal settings all differ from the defaults. A temporal
 * case that passes under it renders from the stored value alone rather than
 * inheriting whatever the connected session happens to be set to.
 */
/**
 * `extra_float_digits` decides how many digits PostgreSQL prints for a float.
 * At its default of 1 (PostgreSQL 12 and later) it prints the shortest decimal
 * that round-trips; at 0 or below it reverts to a fixed count and truncates.
 * The float codecs' canonical form holds at 1 and above, which these sessions
 * pin so the claim does not rest on the server's default being right.
 */
const floatDigitsSession = (digits: 1 | 3): readonly string[] => [
  `SET extra_float_digits = ${digits}`,
];

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
  // These values are chosen to discriminate between `extra_float_digits`
  // settings, and a simpler one would pin nothing: 0.1 prints as `0.1` at every
  // setting, so a case built on it cannot tell them apart. Each width needs its
  // own value, because each projection prints a different thing:
  //
  //   float8  prints the shortest float8 decimal, so the value is 1/3 itself
  //   float4  prints the shortest *float4* decimal, so the value is the float64
  //           that decimal reads back as — not `Math.fround(1/3)`, which is a
  //           different number that would not survive the printing
  //
  // At `extra_float_digits = 0` these print 15 and 6 significant digits
  // respectively, and neither round-trips.
  {
    codecId: 'pg/float8@1',
    label: 'full precision at the float-digits floor',
    value: 1 / 3,
    setupSql: floatDigitsSession(1),
  },
  {
    codecId: 'pg/float8@1',
    label: 'full precision above the float-digits floor',
    value: 1 / 3,
    setupSql: floatDigitsSession(3),
  },
  {
    codecId: 'pg/float4@1',
    label: 'full precision at the float-digits floor',
    value: 0.33333334,
    setupSql: floatDigitsSession(1),
  },
  {
    codecId: 'pg/float4@1',
    label: 'full precision above the float-digits floor',
    value: 0.33333334,
    setupSql: floatDigitsSession(3),
  },
  {
    codecId: 'pg/float@1',
    label: 'full precision at the float-digits floor',
    value: 1 / 3,
    setupSql: floatDigitsSession(1),
  },
  {
    codecId: 'pg/float@1',
    label: 'full precision above the float-digits floor',
    value: 1 / 3,
    setupSql: floatDigitsSession(3),
  },
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
  // RFC 2045 base64 breaks every 76 characters, which is 57 bytes in. A value
  // has to cross that to show whether the projection carries the break through.
  {
    codecId: 'pg/bytea@1',
    label: 'byte string one past the base64 line break',
    value: Uint8Array.from({ length: 57 }, (_, index) => index),
  },
  {
    codecId: 'pg/bytea@1',
    label: 'byte string spanning several base64 line breaks',
    value: Uint8Array.from({ length: 200 }, (_, index) => (index * 7) % 256),
  },
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
  // A month has no fixed length, so P1M and P30D must stay distinct rather than
  // collapsing through a common epoch.
  { codecId: 'pg/interval@1', label: 'one month', value: 'P1M' },
  { codecId: 'pg/interval@1', label: 'thirty days', value: 'P30D' },
  { codecId: 'pg/interval@1', label: 'every component', value: 'P1Y2M3DT4H5M6S' },
  { codecId: 'pg/interval@1', label: 'fractional seconds', value: 'PT1.234567S' },
  { codecId: 'pg/interval@1', label: 'mixed signs', value: 'P1M-1D' },
  { codecId: 'pg/interval@1', label: 'wholly negative', value: 'P-1M-1DT-1.25S' },
  { codecId: 'pg/interval@1', label: 'zero', value: 'PT0S' },
  {
    codecId: 'pg/interval@1',
    label: 'every component under a hostile session',
    value: 'P1Y2M3DT4H5M6S',
    setupSql: HOSTILE_TEMPORAL_SESSION,
  },
  {
    codecId: 'pg/interval@1',
    label: 'mixed signs under a hostile session',
    value: 'P1M-1D',
    setupSql: HOSTILE_TEMPORAL_SESSION,
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
  {
    codecId: 'pg/text-array@1',
    label: 'elements containing array-literal punctuation',
    value: ['a,b', '{c}', 'd"e', 'f\\g', '', ' h '],
  },
  {
    codecId: 'pg/text@1',
    label: 'text needing JSON escaping',
    value: 'quote " backslash \\ newline \n tab \t',
  },
  { codecId: 'pg/text@1', label: 'text beyond the basic plane', value: 'a\u{1F600}b' },
  {
    codecId: 'pg/varchar@1',
    label: 'text needing JSON escaping',
    value: 'quote " backslash \\ newline \n',
  },
  { codecId: 'pg/char@1', label: 'character beyond the basic plane', value: '\u{1F600}' },
  { codecId: 'sql/text@1', label: 'text needing JSON escaping', value: 'quote " backslash \\' },
  { codecId: 'pg/float4@1', label: 'float not exactly representable', value: 0.1 },
  { codecId: 'pg/int2@1', label: 'int2 upper bound', value: 32767 },
  { codecId: 'pg/int2@1', label: 'int2 lower bound', value: -32768 },
  {
    codecId: 'pg/jsonb@1',
    label: 'document whose keys jsonb reorders',
    value: { zebra: 1, a: 2, mm: 3 },
  },
  {
    codecId: 'pg/json@1',
    label: 'document with strings needing escaping',
    value: { 'k"y': 'v\\a"l', nested: ['x\ny'] },
  },
];
