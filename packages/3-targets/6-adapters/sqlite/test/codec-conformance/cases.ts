/**
 * Representative application values for every built-in SQLite codec descriptor,
 * exercised against a real database by the conformance suite.
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
 * typical is the one least likely to expose a format defect, so prefer values
 * that sit just past a representation's limits over values that sit comfortably
 * inside all of them.
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
    notYetCanonical: {
      kind: 'execution',
      reason: 'SQLite JSON rejects a BLOB, so the identity projection cannot execute at all',
    },
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
    notYetCanonical: {
      kind: 'mismatch',
      reason:
        'a document stored as text arrives as a JSON string, not a JSON document, until the projection retags it',
    },
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
    notYetCanonical: {
      kind: 'encode-json-rejects',
      reason:
        'the canonical JSON is a number, so a value outside the safe-integer range has no representation',
    },
  },
];
