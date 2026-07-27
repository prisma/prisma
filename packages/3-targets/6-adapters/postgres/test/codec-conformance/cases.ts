/**
 * Representative application values for every built-in PostgreSQL codec
 * descriptor, exercised against a real database by the conformance suite.
 *
 * `notYetCanonical` marks the cases whose projection does not yet realize the
 * codec's canonical JSON. That set is the outstanding work: each entry names
 * the gap that remains open, and the suite asserts it really is still open, so
 * closing one without updating this file turns the suite red.
 */

import type { PostgresCodecConformanceCase } from './harness';

const ENUM_TYPE = 'codec_conformance_mood';

export const postgresConformanceCases: readonly PostgresCodecConformanceCase[] = [
  { codecId: 'sql/char@1', label: 'single character', value: 'a' },
  { codecId: 'sql/varchar@1', label: 'text', value: 'hello' },
  { codecId: 'sql/int@1', label: 'integer', value: 42 },
  { codecId: 'sql/float@1', label: 'finite float', value: 1.5 },
  { codecId: 'sql/text@1', label: 'text', value: 'hello' },
  {
    codecId: 'sql/timestamp@1',
    label: 'instant',
    value: new Date('2026-01-02T03:04:05.678Z'),
    notYetCanonical:
      'the identity projection renders a timestamp without the trailing Z that encodeJson emits',
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
  { codecId: 'pg/int8@1', label: 'largest safe integer', value: 9007199254740991 },
  { codecId: 'pg/float4@1', label: 'finite float', value: 1.5 },
  { codecId: 'pg/float8@1', label: 'finite float', value: 1.5 },
  { codecId: 'pg/numeric@1', label: 'representable decimal', value: '1.5' },
  {
    codecId: 'pg/numeric@1',
    label: 'integer beyond double precision',
    value: '9007199254740993',
    notYetCanonical:
      'numeric reaches JSON as a number, so the value is rounded to the nearest double before anything can read it',
  },
  {
    codecId: 'pg/numeric@1',
    label: 'twenty fractional digits',
    value: '1234567890.12345678901234567890',
    notYetCanonical:
      'numeric reaches JSON as a number, so the fractional digits beyond double precision are lost',
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
    codecId: 'pg/timestamptz@1',
    label: 'instant with milliseconds',
    value: new Date('2026-01-02T03:04:05.678Z'),
  },
  { codecId: 'pg/time@1', label: 'time of day', value: '03:04:05' },
  { codecId: 'pg/timetz@1', label: 'time of day at UTC', value: '03:04:05+00' },
  { codecId: 'pg/interval@1', label: 'day interval', value: '1 day' },
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

export const postgresNotYetCanonicalCases: readonly PostgresCodecConformanceCase[] =
  postgresConformanceCases.filter((entry) => entry.notYetCanonical !== undefined);
