/**
 * Representative application values for every built-in SQLite codec descriptor,
 * exercised against a real database by the conformance suite.
 *
 * `notYetCanonical` marks the cases whose projection does not yet realize the
 * codec's canonical JSON. That set is the outstanding work: each entry names
 * the gap that remains open, and the suite asserts it really is still open, so
 * closing one without updating this file turns the suite red.
 */

import type { SqliteCodecConformanceCase } from './harness';

export const sqliteConformanceCases: readonly SqliteCodecConformanceCase[] = [
  { codecId: 'sql/char@1', label: 'single character', value: 'a', storageType: 'TEXT' },
  { codecId: 'sql/varchar@1', label: 'text', value: 'hello', storageType: 'TEXT' },
  { codecId: 'sql/int@1', label: 'integer', value: 42, storageType: 'INTEGER' },
  { codecId: 'sql/float@1', label: 'finite float', value: 1.5, storageType: 'REAL' },
  { codecId: 'sqlite/text@1', label: 'text', value: 'hello', storageType: 'TEXT' },
  { codecId: 'sqlite/integer@1', label: 'integer', value: 42, storageType: 'INTEGER' },
  { codecId: 'sqlite/real@1', label: 'finite float', value: 1.5, storageType: 'REAL' },
  {
    codecId: 'sqlite/blob@1',
    label: 'byte string',
    value: new Uint8Array([0, 1, 255]),
    storageType: 'BLOB',
    notYetCanonical: 'SQLite JSON rejects a BLOB, so the identity projection cannot execute at all',
  },
  {
    codecId: 'sqlite/datetime@1',
    label: 'instant with milliseconds',
    value: new Date('2026-01-02T03:04:05.678Z'),
    storageType: 'TEXT',
  },
  {
    codecId: 'sqlite/json@1',
    label: 'document',
    value: { a: 1, b: ['x'] },
    storageType: 'TEXT',
    notYetCanonical:
      'a document stored as text arrives as a JSON string, not a JSON document, until the projection retags it',
  },
  {
    codecId: 'sqlite/bigint@1',
    label: 'small integer',
    value: 42n,
    storageType: 'INTEGER',
  },
  {
    codecId: 'sqlite/bigint@1',
    label: 'integer beyond double precision',
    value: 9007199254740993n,
    storageType: 'INTEGER',
    notYetCanonical:
      'the canonical JSON is a number, so a value outside the safe-integer range has no representation',
  },
];

export const sqliteNotYetCanonicalCases: readonly SqliteCodecConformanceCase[] =
  sqliteConformanceCases.filter((entry) => entry.notYetCanonical !== undefined);
