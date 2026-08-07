/**
 * Measures the PostgreSQL target's aggregate descriptors against the database
 * they describe.
 *
 * For every built-in codec and every built-in aggregate the suite asks two
 * questions of a live PostgreSQL: does this aggregate exist over this type at
 * all, and — when it does — what type does it return? Both answers are compared
 * against what the aggregate registry resolves, so a descriptor claiming a
 * result codec PostgreSQL does not produce fails here, and so does a pair the
 * descriptors leave unclaimed that PostgreSQL would in fact aggregate.
 *
 * Result types are compared as `regtype`, which ignores type modifiers: what is
 * asserted is that `min` over a `numeric(10,3)` returns *a* numeric, not that it
 * returns one of the same precision.
 *
 * The pairs PostgreSQL refuses, and which therefore carry no descriptor:
 * `sum`/`avg` over every non-numeric, non-temporal type (including `money`,
 * which has a `sum` but no `avg`, and no codec of its own in this target); and
 * `min`/`max` over `bool`, `uuid`, `bytea`, `bit`, `bit varying`, `json`, and
 * `jsonb` — all of which advertise `equality` or `order` and would have been
 * swept up by a trait fallback inferred from traits rather than probed.
 */

import type { JsonValue } from '@internal/contract/types';
import postgresControlDriverDescriptor from '@internal/driver-postgres/control';
import type { CodecRef } from '@internal/framework-components/codec';
import { SqlQueryError } from '@internal/sql-errors';
import { buildSqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import { postgresAggregateDescriptors } from '@internal/target-postgres/aggregates';
import {
  postgresCodecDescriptorRegistry,
  postgresCodecRegistry,
} from '@internal/target-postgres/codecs';
import { ifDefined } from '@internal/utils/defined';
import { createDevDatabase, timeouts } from '@repo/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const registry = buildSqlAggregateDescriptorRegistry(
  postgresAggregateDescriptors,
  postgresCodecRegistry,
);

const OPERATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;

const ENUM_TYPE = 'aggregate_conformance_enum';

interface AggregateFixture {
  readonly codecId: string;
  readonly typeParams?: JsonValue;
  /** Two SQL literals of the codec's native type, so every aggregate has something to fold. */
  readonly samples: readonly [string, string];
  /** SQL that must run before a column of this codec's native type can exist. */
  readonly setupSql?: readonly string[];
}

/**
 * One fixture per built-in codec — enforced by a test below, so a codec added to
 * the target cannot skip the matrix.
 */
const FIXTURES: readonly AggregateFixture[] = [
  { codecId: 'sql/char@1', samples: ["'a'", "'b'"] },
  { codecId: 'sql/varchar@1', samples: ["'a'", "'b'"] },
  { codecId: 'sql/int@1', samples: ['1', '2'] },
  { codecId: 'sql/float@1', samples: ['1.5', '2.5'] },
  { codecId: 'sql/text@1', samples: ["'a'", "'b'"] },
  { codecId: 'sql/timestamp@1', samples: ["'2024-01-01T10:00:00'", "'2024-02-01T10:00:00'"] },
  { codecId: 'pg/text@1', samples: ["'a'", "'b'"] },
  {
    codecId: 'pg/enum@1',
    typeParams: { typeName: ENUM_TYPE },
    samples: ["'low'", "'high'"],
    setupSql: [
      `DROP TYPE IF EXISTS ${ENUM_TYPE}`,
      `CREATE TYPE ${ENUM_TYPE} AS ENUM ('low', 'high')`,
    ],
  },
  { codecId: 'pg/char@1', samples: ["'a'", "'b'"] },
  { codecId: 'pg/varchar@1', samples: ["'a'", "'b'"] },
  { codecId: 'pg/int@1', samples: ['1', '2'] },
  { codecId: 'pg/float@1', samples: ['1.5', '2.5'] },
  { codecId: 'pg/int4@1', samples: ['1', '2'] },
  { codecId: 'pg/int2@1', samples: ['1', '2'] },
  { codecId: 'pg/int8@1', samples: ['1', '2'] },
  { codecId: 'pg/int8number@1', samples: ['1', '2'] },
  { codecId: 'pg/float4@1', samples: ['1.5', '2.5'] },
  { codecId: 'pg/float8@1', samples: ['1.5', '2.5'] },
  { codecId: 'pg/numeric@1', samples: ['1.5', '2.5'] },
  { codecId: 'pg/unboundedint@1', samples: ['1', '2'] },
  { codecId: 'pg/date@1', samples: ["'2024-01-01'", "'2024-02-01'"] },
  { codecId: 'pg/timestamp@1', samples: ["'2024-01-01T10:00:00'", "'2024-02-01T10:00:00'"] },
  { codecId: 'pg/timestamptz@1', samples: ["'2024-01-01T10:00:00Z'", "'2024-02-01T10:00:00Z'"] },
  { codecId: 'pg/time@1', samples: ["'10:00:00'", "'11:00:00'"] },
  { codecId: 'pg/timetz@1', samples: ["'10:00:00+00'", "'11:00:00+00'"] },
  { codecId: 'pg/bool@1', samples: ['true', 'false'] },
  { codecId: 'pg/bit@1', samples: ["B'1'", "B'0'"] },
  { codecId: 'pg/varbit@1', samples: ["B'101'", "B'1100'"] },
  { codecId: 'pg/bytea@1', samples: ["'\\x01'", "'\\x02'"] },
  {
    codecId: 'pg/uuid@1',
    samples: ["'11111111-1111-1111-1111-111111111111'", "'22222222-2222-2222-2222-222222222222'"],
  },
  { codecId: 'pg/inet@1', samples: ["'10.0.0.1'", "'10.0.0.2'"] },
  { codecId: 'pg/interval@1', samples: ["'1 day'", "'2 days'"] },
  { codecId: 'pg/json@1', samples: ['\'{"a":1}\'', '\'{"b":2}\''] },
  { codecId: 'pg/jsonb@1', samples: ['\'{"a":1}\'', '\'{"b":2}\''] },
  { codecId: 'pg/text-array@1', samples: ["ARRAY['a']", "ARRAY['b']"] },
];

const TABLE = 'aggregate_conformance';
const COLUMN = 'value';

function refOf(fixture: AggregateFixture): CodecRef {
  return { codecId: fixture.codecId, ...ifDefined('typeParams', fixture.typeParams) };
}

function nativeTypeOf(ref: CodecRef): string {
  const descriptor = postgresCodecDescriptorRegistry.descriptorFor(ref.codecId);
  if (descriptor === undefined) {
    throw new Error(`No PostgreSQL codec descriptor for '${ref.codecId}'.`);
  }
  return descriptor.nativeTypeFor(ref);
}

type Query = (sql: string) => Promise<ReadonlyArray<Record<string, unknown>>>;

/** SQLSTATE `undefined_function` — what PostgreSQL raises for an aggregate it does not have over this type (probed: `sum(bool)` → 42883). */
const UNDEFINED_FUNCTION = '42883';

/**
 * The result type PostgreSQL gives `operation` over the fixture's column, or
 * `undefined` when it has no such aggregate. Only `undefined_function` reads as
 * refusal — the harness driver normalizes SQLSTATE errors onto
 * `SqlQueryError.sqlState`, and anything else (a missing table's 42P01, a
 * dropped connection, a syntax slip) is rethrown: in the unclaimed direction a
 * swallowed infrastructure error would pass the matrix vacuously.
 */
async function probeResultType(query: Query, operation: string): Promise<string | undefined> {
  try {
    const rows = await query(
      `SELECT pg_typeof(${operation}("${COLUMN}"))::text AS result FROM "${TABLE}"`,
    );
    return String(rows[0]?.['result']);
  } catch (error) {
    if (SqlQueryError.is(error) && error.sqlState === UNDEFINED_FUNCTION) return undefined;
    throw error;
  }
}

/** Whether PostgreSQL considers the aggregate's result type and the declared codec's native type the same type, modifiers aside. */
async function producesDeclaredType(
  query: Query,
  operation: string,
  declaredNativeType: string,
): Promise<boolean> {
  const rows = await query(
    `SELECT pg_typeof(${operation}("${COLUMN}")) = pg_typeof(NULL::${declaredNativeType}) AS agrees FROM "${TABLE}"`,
  );
  return rows[0]?.['agrees'] === true;
}

describe.sequential('PostgreSQL aggregate conformance', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>> | undefined;
  let driver: Awaited<ReturnType<typeof postgresControlDriverDescriptor.create>> | undefined;
  let query: Query;

  beforeAll(async () => {
    database = await createDevDatabase();
    driver = await postgresControlDriverDescriptor.create(database.connectionString);
    query = async (sql) => (await driver!.query(sql, [])).rows;
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    await driver?.close();
    driver = undefined;
    await database?.close();
    database = undefined;
  }, timeouts.spinUpPpgDev);

  async function withFixtureTable<T>(
    fixture: AggregateFixture,
    body: () => Promise<T>,
  ): Promise<T> {
    await query(`DROP TABLE IF EXISTS "${TABLE}"`);
    for (const statement of fixture.setupSql ?? []) {
      await query(statement);
    }
    const nativeType = nativeTypeOf(refOf(fixture));
    await query(`CREATE TABLE "${TABLE}" ("${COLUMN}" ${nativeType})`);
    for (const sample of fixture.samples) {
      await query(`INSERT INTO "${TABLE}" ("${COLUMN}") VALUES ((${sample})::${nativeType})`);
    }
    return body();
  }

  it('covers every built-in codec', () => {
    const fixtured = new Set(FIXTURES.map((fixture) => fixture.codecId));
    const uncovered = [...postgresCodecRegistry.values()]
      .map((descriptor) => descriptor.codecId)
      .filter((codecId) => !fixtured.has(codecId));

    expect(uncovered).toEqual([]);
  });

  it(
    'declares the result type PostgreSQL produces, for every aggregate it declares',
    async () => {
      const disagreements: unknown[] = [];

      for (const fixture of FIXTURES) {
        await withFixtureTable(fixture, async () => {
          for (const operation of OPERATIONS) {
            const resolved = registry.resolve(operation, refOf(fixture));
            if (resolved === undefined) continue;

            const actual = await probeResultType(query, operation);
            if (actual === undefined) {
              disagreements.push({
                operation,
                codecId: fixture.codecId,
                declared: resolved.output.codecId,
                actual: 'PostgreSQL has no such aggregate',
              });
              continue;
            }
            const declaredNativeType = nativeTypeOf(resolved.output);
            if (!(await producesDeclaredType(query, operation, declaredNativeType))) {
              disagreements.push({
                operation,
                codecId: fixture.codecId,
                declared: `${resolved.output.codecId} (${declaredNativeType})`,
                actual,
              });
            }
          }
        });
      }

      expect(disagreements).toEqual([]);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'leaves unclaimed only the pairs PostgreSQL refuses',
    async () => {
      const unclaimedButSupported: unknown[] = [];

      for (const fixture of FIXTURES) {
        await withFixtureTable(fixture, async () => {
          for (const operation of OPERATIONS) {
            if (registry.resolve(operation, refOf(fixture)) !== undefined) continue;

            const actual = await probeResultType(query, operation);
            if (actual !== undefined) {
              unclaimedButSupported.push({ operation, codecId: fixture.codecId, actual });
            }
          }
        });
      }

      expect(unclaimedButSupported).toEqual([]);
    },
    timeouts.spinUpPpgDev,
  );

  it('pins the breaking baseline', () => {
    expect(registry.resolve('count')?.output).toEqual({ codecId: 'pg/int8@1' });
    expect(registry.resolve('sum', { codecId: 'pg/int2@1' })?.output).toEqual({
      codecId: 'pg/int8@1',
    });
    expect(registry.resolve('sum', { codecId: 'pg/int4@1' })?.output).toEqual({
      codecId: 'pg/int8@1',
    });
    expect(registry.resolve('sum', { codecId: 'pg/int8@1' })?.output).toEqual({
      codecId: 'pg/numeric@1',
    });
    expect(registry.resolve('avg', { codecId: 'pg/int4@1' })?.output).toEqual({
      codecId: 'pg/numeric@1',
    });
    expect(registry.resolve('min', { codecId: 'pg/int4@1' })?.output).toEqual({
      codecId: 'pg/int4@1',
    });
  });

  it('resolves count with and without an input', () => {
    expect(registry.resolve('count')).toEqual({
      operation: 'count',
      output: { codecId: 'pg/int8@1' },
      nullable: false,
      lower: undefined,
    });
    expect(registry.resolve('count', { codecId: 'pg/text@1' })?.output).toEqual({
      codecId: 'pg/int8@1',
    });
  });

  it('prefers the exact varchar overload over the textual fallback', () => {
    expect(
      registry.resolve('min', { codecId: 'pg/varchar@1', typeParams: { length: 10 } })?.output,
    ).toEqual({ codecId: 'pg/text@1' });
    expect(registry.resolve('min', { codecId: 'pg/text@1' })?.output).toEqual({
      codecId: 'pg/text@1',
    });
    expect(
      registry.resolve('max', { codecId: 'pg/char@1', typeParams: { length: 3 } })?.output,
    ).toEqual({
      codecId: 'pg/char@1',
      typeParams: { length: 3 },
    });
  });

  it(
    'sums int8number past the safe range into a numeric that arrives as decimal text',
    async () => {
      await withFixtureTable(
        { codecId: 'pg/int8number@1', samples: ['9007199254740991', '9007199254740991'] },
        async () => {
          const rows = await query(`SELECT sum("${COLUMN}") AS total FROM "${TABLE}"`);
          const wire = rows[0]?.['total'];
          expect(wire).toBe('18014398509481982');

          const resolved = registry.resolve('sum', { codecId: 'pg/int8number@1' });
          expect(resolved?.output).toEqual({ codecId: 'pg/numeric@1' });

          const numericCodec = postgresCodecRegistry
            .descriptorFor('pg/numeric@1')!
            .factory(undefined)({ name: 'aggregate-conformance' });
          expect(await numericCodec.decode(wire, {})).toBe('18014398509481982');
        },
      );

      expect(registry.resolve('avg', { codecId: 'pg/int8number@1' })?.output).toEqual({
        codecId: 'pg/numeric@1',
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'sums unboundedint past 2^63 into an exact bigint through its own codec',
    async () => {
      await withFixtureTable(
        { codecId: 'pg/unboundedint@1', samples: ['9223372036854775807', '1000'] },
        async () => {
          const rows = await query(`SELECT sum("${COLUMN}") AS total FROM "${TABLE}"`);
          const wire = rows[0]?.['total'];
          expect(wire).toBe('9223372036854776807');

          const resolved = registry.resolve('sum', { codecId: 'pg/unboundedint@1' });
          expect(resolved?.output).toEqual({ codecId: 'pg/unboundedint@1' });

          const unboundedIntCodec = postgresCodecRegistry
            .descriptorFor('pg/unboundedint@1')!
            .factory(undefined)({ name: 'aggregate-conformance' });
          expect(await unboundedIntCodec.decode(wire, {})).toBe(9223372036854776807n);
        },
      );

      expect(registry.resolve('avg', { codecId: 'pg/unboundedint@1' })?.output).toEqual({
        codecId: 'pg/numeric@1',
      });
    },
    timeouts.spinUpPpgDev,
  );

  it('resolves min/max over the representation codecs through the numeric-trait fallback', () => {
    expect(registry.resolve('min', { codecId: 'pg/int8number@1' })?.output).toEqual({
      codecId: 'pg/int8number@1',
    });
    expect(registry.resolve('max', { codecId: 'pg/int8number@1' })?.output).toEqual({
      codecId: 'pg/int8number@1',
    });
    expect(registry.resolve('min', { codecId: 'pg/unboundedint@1' })?.output).toEqual({
      codecId: 'pg/unboundedint@1',
    });
    expect(registry.resolve('max', { codecId: 'pg/unboundedint@1' })?.output).toEqual({
      codecId: 'pg/unboundedint@1',
    });
  });

  it(
    'declares the nullability an empty set produces',
    async () => {
      await withFixtureTable({ codecId: 'pg/int4@1', samples: ['1', '2'] }, async () => {
        const rows = await query(
          `SELECT count("${COLUMN}") AS c, sum("${COLUMN}") AS s, avg("${COLUMN}") AS a, min("${COLUMN}") AS m FROM "${TABLE}" WHERE false`,
        );
        const row = rows[0] ?? {};

        expect({
          count: row['c'] !== null,
          sum: row['s'] === null,
          avg: row['a'] === null,
          min: row['m'] === null,
        }).toEqual({ count: true, sum: true, avg: true, min: true });

        expect(registry.resolve('count')?.nullable).toBe(false);
        expect(registry.resolve('sum', { codecId: 'pg/int4@1' })?.nullable).toBe(true);
        expect(registry.resolve('avg', { codecId: 'pg/int4@1' })?.nullable).toBe(true);
        expect(registry.resolve('min', { codecId: 'pg/int4@1' })?.nullable).toBe(true);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
