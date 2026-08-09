/**
 * Measures the SQLite target's aggregate descriptors against the database they
 * describe.
 *
 * SQLite types values rather than columns, so what this suite compares is
 * storage classes: for every built-in codec and every built-in aggregate it
 * asks a live SQLite what `typeof()` the aggregate's result has, and requires
 * that to be the storage class of the codec the registry resolves.
 *
 * The second half of the measurement is the pairs left unclaimed. SQLite has no
 * aggregate it refuses: `sum` and `avg` over `TEXT` or `BLOB` read a leading
 * number where there is one and 0 where there is not, so `sum` over a column of
 * words is `0.0`, `sum` over a column of numerals is their total, and the result
 * changes storage class with the rows. An aggregate whose result type cannot be
 * known from the schema is one this target declines to type, so those pairs
 * carry no descriptor — and the suite pins the list, so a pair cannot quietly
 * join or leave it.
 *
 * The probed behaviours behind the `sum` declarations, on SQLite 3.53:
 *
 * - `sum` over integers stays an integer, and an overflow past 64 bits raises
 *   `integer overflow` rather than promoting to a float — so the result is an
 *   integer or it is an error, never a rounded double.
 * - That integer is free to exceed 2^53 (two rows of 9007199254740993 sum to
 *   9007199254740995), which is why integer `sum` declares `sqlite/bigint@1`
 *   rather than `sqlite/integer@1`.
 * - `avg` is `real` for every input, integers included.
 * - `min`/`max` return a value of the input's own storage class, blobs included.
 */

import { DatabaseSync } from 'node:sqlite';
import { buildSqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import { AggregateExpr, CastExpr, ColumnRef } from '@internal/sql-relational-core/ast';
import { sqliteAggregateDescriptors } from '@internal/target-sqlite/aggregates';
import { sqliteCodecRegistry } from '@internal/target-sqlite/codecs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const registry = buildSqlAggregateDescriptorRegistry(
  sqliteAggregateDescriptors,
  sqliteCodecRegistry,
);

const OPERATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;

interface AggregateFixture {
  readonly codecId: string;
  /** SQLite column type the target stores this codec in. */
  readonly storageType: string;
  /** `typeof()` of a value stored through this codec — the class its aggregates are measured against. */
  readonly storageClass: 'integer' | 'real' | 'text' | 'blob';
  /** Two SQL literals of that storage class, so every aggregate has something to fold. */
  readonly samples: readonly [string, string];
}

/** One fixture per built-in codec — enforced by a test below, so a codec added to the target cannot skip the matrix. */
const FIXTURES: readonly AggregateFixture[] = [
  {
    codecId: 'sql/char@1',
    storageType: 'TEXT',
    storageClass: 'text',
    samples: ["'a'", "'b'"],
  },
  {
    codecId: 'sql/varchar@1',
    storageType: 'TEXT',
    storageClass: 'text',
    samples: ["'a'", "'b'"],
  },
  { codecId: 'sql/int@1', storageType: 'INTEGER', storageClass: 'integer', samples: ['1', '2'] },
  { codecId: 'sql/float@1', storageType: 'REAL', storageClass: 'real', samples: ['1.5', '2.5'] },
  { codecId: 'sqlite/text@1', storageType: 'TEXT', storageClass: 'text', samples: ["'a'", "'b'"] },
  {
    codecId: 'sqlite/integer@1',
    storageType: 'INTEGER',
    storageClass: 'integer',
    samples: ['1', '2'],
  },
  { codecId: 'sqlite/real@1', storageType: 'REAL', storageClass: 'real', samples: ['1.5', '2.5'] },
  {
    codecId: 'sqlite/blob@1',
    storageType: 'BLOB',
    storageClass: 'blob',
    samples: ["x'01'", "x'02'"],
  },
  {
    codecId: 'sqlite/datetime@1',
    storageType: 'TEXT',
    storageClass: 'text',
    samples: ["'2024-01-01T10:00:00.000Z'", "'2024-02-01T10:00:00.000Z'"],
  },
  {
    codecId: 'sqlite/json@1',
    storageType: 'TEXT',
    storageClass: 'text',
    samples: ['\'{"a":1}\'', '\'{"b":2}\''],
  },
  {
    codecId: 'sqlite/bigint@1',
    storageType: 'INTEGER',
    storageClass: 'integer',
    samples: ['9007199254740993', '2'],
  },
  {
    codecId: 'sqlite/bigintnumber@1',
    storageType: 'INTEGER',
    storageClass: 'integer',
    samples: ['1', '2'],
  },
];

/**
 * The pairs SQLite computes and this target declines to type: `sum` and `avg`
 * over every non-numeric codec, whose result is whatever leading numbers the
 * stored text or blob happens to contain.
 */
const COERCED_RATHER_THAN_TYPED = [
  'avg(sql/char@1)',
  'avg(sql/varchar@1)',
  'avg(sqlite/blob@1)',
  'avg(sqlite/datetime@1)',
  'avg(sqlite/json@1)',
  'avg(sqlite/text@1)',
  'sum(sql/char@1)',
  'sum(sql/varchar@1)',
  'sum(sqlite/blob@1)',
  'sum(sqlite/datetime@1)',
  'sum(sqlite/json@1)',
  'sum(sqlite/text@1)',
];

const TABLE = 'aggregate_conformance';
const COLUMN = 'value';

function storageClassOf(codecId: string): string {
  const fixture = FIXTURES.find((entry) => entry.codecId === codecId);
  if (fixture === undefined) {
    throw new Error(`No aggregate fixture for '${codecId}'.`);
  }
  return fixture.storageClass;
}

describe.sequential('SQLite aggregate conformance', () => {
  let database: DatabaseSync | undefined;

  beforeAll(() => {
    database = new DatabaseSync(':memory:');
  });

  afterAll(() => {
    database?.close();
    database = undefined;
  });

  const run = (sql: string): ReadonlyArray<Record<string, unknown>> =>
    database!.prepare(sql).all() as ReadonlyArray<Record<string, unknown>>;

  function withFixtureTable<T>(fixture: AggregateFixture, body: () => T): T {
    run(`DROP TABLE IF EXISTS "${TABLE}"`);
    run(`CREATE TABLE "${TABLE}" ("${COLUMN}" ${fixture.storageType})`);
    for (const sample of fixture.samples) {
      run(`INSERT INTO "${TABLE}" ("${COLUMN}") VALUES (${sample})`);
    }
    return body();
  }

  /**
   * The messages `node:sqlite` raises for a call SQLite refuses outright: an
   * aggregate it does not have, or one invoked with a shape it rejects. Probed
   * empirically — every SQLite error carries the same `ERR_SQLITE_ERROR` code
   * (`no such table` and `integer overflow` included), so the message is the
   * only thing that separates refusal from infrastructure failure.
   */
  const REFUSED_CALL =
    /^(no such function|wrong number of arguments to function|misuse of aggregate)/;

  /**
   * The storage class SQLite gives `operation` over the fixture's column, or
   * `undefined` when it refuses the call. Anything else — a missing table, an
   * overflow, a locked database — is rethrown rather than read as refusal: in
   * the unclaimed direction a swallowed infrastructure error would pass the
   * matrix vacuously.
   */
  function probeStorageClass(operation: string): string | undefined {
    try {
      const rows = run(`SELECT typeof(${operation}("${COLUMN}")) AS result FROM "${TABLE}"`);
      return String(rows[0]?.['result']);
    } catch (error) {
      if (error instanceof Error && REFUSED_CALL.test(error.message)) return undefined;
      throw error;
    }
  }

  it('covers every built-in codec', () => {
    const fixtured = new Set(FIXTURES.map((fixture) => fixture.codecId));
    const uncovered = [...sqliteCodecRegistry.values()]
      .map((descriptor) => descriptor.codecId)
      .filter((codecId) => !fixtured.has(codecId));

    expect(uncovered).toEqual([]);
  });

  it('declares the storage class SQLite produces, for every aggregate it declares', () => {
    const disagreements: unknown[] = [];

    for (const fixture of FIXTURES) {
      withFixtureTable(fixture, () => {
        for (const operation of OPERATIONS) {
          const resolved = registry.resolve(operation, { codecId: fixture.codecId });
          if (resolved === undefined) continue;

          const actual = probeStorageClass(operation);
          const declared = storageClassOf(resolved.output.codecId);
          if (actual !== declared) {
            disagreements.push({
              operation,
              codecId: fixture.codecId,
              declared: `${resolved.output.codecId} (${declared})`,
              actual,
            });
          }
        }
      });
    }

    expect(disagreements).toEqual([]);
  });

  it('leaves unclaimed exactly the pairs whose result SQLite coerces', () => {
    const unclaimed: string[] = [];
    const unclaimedAndRefused: string[] = [];

    for (const fixture of FIXTURES) {
      withFixtureTable(fixture, () => {
        for (const operation of OPERATIONS) {
          if (registry.resolve(operation, { codecId: fixture.codecId }) !== undefined) continue;

          const pair = `${operation}(${fixture.codecId})`;
          unclaimed.push(pair);
          if (probeStorageClass(operation) === undefined) unclaimedAndRefused.push(pair);
        }
      });
    }

    expect(unclaimed.sort()).toEqual(COERCED_RATHER_THAN_TYPED);
    // SQLite has no aggregate it refuses over a stored value, so nothing is unclaimed for that reason.
    expect(unclaimedAndRefused).toEqual([]);
  });

  it('pins count to the bigint codec, with and without an input', () => {
    // `lower` is the cast that keeps a wide count readable; its shape is
    // asserted where the lowering itself is, below.
    expect(registry.resolve('count')).toMatchObject({
      operation: 'count',
      output: { codecId: 'sqlite/bigint@1' },
      nullable: false,
    });
    expect(registry.resolve('count', { codecId: 'sqlite/text@1' })?.output).toEqual({
      codecId: 'sqlite/bigint@1',
    });
  });

  it('sums integers into a value beyond the safe-integer range, which only the bigint codec carries', () => {
    withFixtureTable(FIXTURES.find((entry) => entry.codecId === 'sqlite/bigint@1')!, () => {
      const [row] = run(
        `SELECT typeof(sum("${COLUMN}")) AS class, CAST(sum("${COLUMN}") AS TEXT) AS total FROM "${TABLE}"`,
      );

      expect(row?.['class']).toBe('integer');
      expect(row?.['total']).toBe('9007199254740995');
      expect(Number(row?.['total']) > Number.MAX_SAFE_INTEGER).toBe(true);
    });

    expect(registry.resolve('sum', { codecId: 'sqlite/integer@1' })?.output).toEqual({
      codecId: 'sqlite/bigint@1',
    });
    expect(registry.resolve('sum', { codecId: 'sqlite/bigint@1' })?.output).toEqual({
      codecId: 'sqlite/bigint@1',
    });
  });

  it('sums bigintnumber past the safe range into a bigint through the cast-to-text lowering', async () => {
    withFixtureTable(
      {
        codecId: 'sqlite/bigintnumber@1',
        storageType: 'INTEGER',
        storageClass: 'integer',
        samples: ['9007199254740991', '9007199254740991'],
      },
      () => {
        const [row] = run(
          `SELECT typeof(sum("${COLUMN}")) AS class, CAST(sum("${COLUMN}") AS TEXT) AS total FROM "${TABLE}"`,
        );

        expect(row?.['class']).toBe('integer');
        expect(row?.['total']).toBe('18014398509481982');
      },
    );

    const resolved = registry.resolve('sum', { codecId: 'sqlite/bigintnumber@1' });
    expect(resolved?.output).toEqual({ codecId: 'sqlite/bigint@1' });

    const lowered = resolved?.lower?.({
      expr: ColumnRef.of('t', 'c'),
      inputCodec: { codecId: 'sqlite/bigintnumber@1' },
    });
    expect(lowered).toEqual(CastExpr.as(AggregateExpr.sum(ColumnRef.of('t', 'c')), 'text'));

    const bigintCodec = sqliteCodecRegistry.descriptorFor('sqlite/bigint@1')!.factory(undefined)({
      name: 'aggregate-conformance',
    });
    expect(await bigintCodec.decode('18014398509481982', {})).toBe(18014398509481982n);

    expect(registry.resolve('avg', { codecId: 'sqlite/bigintnumber@1' })?.output).toEqual({
      codecId: 'sqlite/real@1',
    });
  });

  // The min/max fallback rows carry no text cast; the codec's wire decode
  // accepts a `number` or an in-range `bigint`, so an extremum of stored
  // safe-range values is always readable.
  it('resolves min/max over bigintnumber to itself, without a lowering', () => {
    const resolved = registry.resolve('min', { codecId: 'sqlite/bigintnumber@1' });
    expect(resolved?.output).toEqual({ codecId: 'sqlite/bigintnumber@1' });
    expect(resolved?.lower).toBeUndefined();

    expect(registry.resolve('max', { codecId: 'sqlite/bigintnumber@1' })?.output).toEqual({
      codecId: 'sqlite/bigintnumber@1',
    });
  });

  it('raises on integer sum overflow rather than widening to a float', () => {
    expect(() =>
      run(
        'SELECT sum(x) AS total FROM (SELECT 9223372036854775807 AS x UNION ALL SELECT 9223372036854775807)',
      ),
    ).toThrow(/integer overflow/);
  });

  it('averages integers into a real', () => {
    withFixtureTable(FIXTURES.find((entry) => entry.codecId === 'sqlite/integer@1')!, () => {
      expect(run(`SELECT typeof(avg("${COLUMN}")) AS class FROM "${TABLE}"`)[0]?.['class']).toBe(
        'real',
      );
    });

    expect(registry.resolve('avg', { codecId: 'sqlite/integer@1' })?.output).toEqual({
      codecId: 'sqlite/real@1',
    });
  });

  it('declares the nullability an empty set produces', () => {
    withFixtureTable(FIXTURES.find((entry) => entry.codecId === 'sqlite/integer@1')!, () => {
      const [row] = run(
        `SELECT count("${COLUMN}") AS c, sum("${COLUMN}") AS s, avg("${COLUMN}") AS a, min("${COLUMN}") AS m FROM "${TABLE}" WHERE 0`,
      );

      expect({
        count: row?.['c'] !== null,
        sum: row?.['s'] === null,
        avg: row?.['a'] === null,
        min: row?.['m'] === null,
      }).toEqual({ count: true, sum: true, avg: true, min: true });
    });

    expect(registry.resolve('count')?.nullable).toBe(false);
    expect(registry.resolve('sum', { codecId: 'sqlite/integer@1' })?.nullable).toBe(true);
    expect(registry.resolve('avg', { codecId: 'sqlite/integer@1' })?.nullable).toBe(true);
    expect(registry.resolve('min', { codecId: 'sqlite/integer@1' })?.nullable).toBe(true);
  });

  // A bigint result leaves the database as text, because `node:sqlite` reads an
  // integer no JS number can hold as an error rather than a value. The lowering
  // is what renders the cast — and it renders only that: the codec the
  // descriptor declared is still the codec the registry resolves.
  describe('bigint results are lowered to text', () => {
    const BEYOND_SAFE = '9007199254740993';

    it('declares a lowering for every aggregate whose result is a bigint', () => {
      const unlowered = [...registry.values()]
        .filter((descriptor) => {
          const resolved = registry.resolve(
            descriptor.operation,
            descriptor.input.kind === 'codec' ? { codecId: descriptor.input.codecId } : undefined,
          );
          return resolved?.output.codecId === 'sqlite/bigint@1' && descriptor.lower === undefined;
        })
        .map((descriptor) => `${descriptor.operation}:${descriptor.input.kind}`);

      expect(unlowered).toEqual([]);
    });

    it('builds a cast over the aggregate, and nothing that names a codec', () => {
      const resolved = registry.resolve('sum', { codecId: 'sqlite/bigint@1' });
      const lowered = resolved?.lower?.({
        expr: ColumnRef.of('t', 'c'),
        inputCodec: { codecId: 'sqlite/bigint@1' },
      });

      expect(lowered).toEqual(CastExpr.as(AggregateExpr.sum(ColumnRef.of('t', 'c')), 'text'));
      // The hook has no channel for a codec, so the result identity is the
      // descriptor's declaration either way.
      expect(resolved?.output).toEqual({ codecId: 'sqlite/bigint@1' });
      expect(registry.resolve('count')?.output).toEqual({ codecId: 'sqlite/bigint@1' });
    });

    it('reads a sum past 2^53 back exactly, where the uncast form cannot be read at all', () => {
      run(`DROP TABLE IF EXISTS "${TABLE}"`);
      run(`CREATE TABLE "${TABLE}" ("${COLUMN}" INTEGER)`);
      run(`INSERT INTO "${TABLE}" ("${COLUMN}") VALUES (${BEYOND_SAFE})`);

      const [row] = run(`SELECT CAST(sum("${COLUMN}") AS text) AS result FROM "${TABLE}"`);
      expect(row?.['result']).toBe(BEYOND_SAFE);

      expect(() => run(`SELECT sum("${COLUMN}") AS result FROM "${TABLE}"`)).toThrow(/too large/);
    });
  });
});
