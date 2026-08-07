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
 * What each row runs is the expression its lowering builds, not a call named
 * after the operation: `countBigInt`, `sumBigInt`, and `avgDecimal` compute with
 * the SQL aggregate their bare namesakes use and differ in how the result is
 * read, and `avg` over an integer casts its result. So every probe here renders
 * the row's own lowering.
 *
 * Two rows declare a codec whose native type is not the type PostgreSQL
 * computes — `sum` over a 64-bit integer, whose `numeric` total the
 * number-flavoured codec reads and range-guards. They are named in
 * `READS_A_COMPUTED_TYPE`, which the matrix measures against and a test holds to
 * being a real divergence.
 *
 * The pairs PostgreSQL refuses, and which therefore carry no descriptor:
 * `sum`/`avg` over every non-numeric, non-temporal type (including `money`,
 * which has a `sum` but no `avg`, and no codec of its own in this target); and
 * `min`/`max` over `bool`, `uuid`, `bytea`, `bit`, `bit varying`, `json`, and
 * `jsonb` — all of which advertise `equality` or `order` and would have been
 * swept up by a trait fallback inferred from traits rather than probed. That
 * measurement applies to the bare operations, whose SQL call is the operation's
 * own name; where a lossless variant is offered is policy, and is pinned as
 * such.
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
import { aggregateSql } from './aggregate-sql';

const registry = buildSqlAggregateDescriptorRegistry(
  postgresAggregateDescriptors,
  postgresCodecRegistry,
);

/** The operations whose SQL call carries the operation's own name, and whose absence over a type PostgreSQL aggregates is therefore a gap. */
const BARE_OPERATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;

/** The lossless variants, each reading the result of the SQL aggregate its bare namesake computes. */
const LOSSLESS_OPERATIONS = ['countBigInt', 'sumBigInt', 'avgDecimal'] as const;

const OPERATIONS = [...BARE_OPERATIONS, ...LOSSLESS_OPERATIONS];

/**
 * The rows whose declared codec reads a computed type other than its own native
 * type, and the type PostgreSQL computes for them. `sum` over a 64-bit integer
 * is a `numeric`, which the number-flavoured codec reads as decimal text and
 * guards against the safe-integer range; casting that total down to `bigint`
 * would raise `bigint out of range` past 2^63 instead.
 */
const READS_A_COMPUTED_TYPE = [
  { operation: 'sum', codecId: 'pg/int8@1', computed: 'numeric' },
  { operation: 'sum', codecId: 'pg/int8number@1', computed: 'numeric' },
] as const;

const computedTypeFor = (operation: string, codecId: string): string | undefined =>
  READS_A_COMPUTED_TYPE.find((row) => row.operation === operation && row.codecId === codecId)
    ?.computed;

/** The result codecs an integer total reads through, whichever form is asked for. Membership of this set is what makes an input an integer one. */
const INTEGER_RESULT_CODEC_IDS = ['pg/int8number@1', 'pg/int8@1', 'pg/unboundedint@1'];

/**
 * The inputs each lossless variant claims. `sumBigInt` covers every integer,
 * `unboundedint` included, whose own `sum` is already exact — the suffix is an
 * escape hatch, and one a caller should be able to reach for over any integer
 * column without learning which widths happen not to need it. `avgDecimal`
 * covers every integer and `numeric`, the inputs whose mean PostgreSQL computes
 * exactly. `countBigInt` is input-agnostic like `count`, so it claims every
 * codec and appears in neither list.
 */
const LOSSLESS_VARIANT_INPUTS: Readonly<Record<string, readonly string[]>> = {
  sumBigInt: [
    'pg/int2@1',
    'pg/int4@1',
    'pg/int8@1',
    'pg/int8number@1',
    'pg/int@1',
    'pg/unboundedint@1',
    'sql/int@1',
  ],
  avgDecimal: [
    'pg/int2@1',
    'pg/int4@1',
    'pg/int8@1',
    'pg/int8number@1',
    'pg/int@1',
    'pg/numeric@1',
    'pg/unboundedint@1',
    'sql/int@1',
  ],
};

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

/** The codecs the bare `sum` totals into an integer result — the integer inputs, read off the matrix rather than listed beside it. */
function integerInputs(): readonly string[] {
  return FIXTURES.map((fixture) => fixture.codecId).filter((codecId) => {
    const resolved = registry.resolve('sum', { codecId });
    return resolved !== undefined && INTEGER_RESULT_CODEC_IDS.includes(resolved.output.codecId);
  });
}

type Query = (sql: string) => Promise<ReadonlyArray<Record<string, unknown>>>;

/** SQLSTATE `undefined_function` — what PostgreSQL raises for an aggregate it does not have over this type (probed: `sum(bool)` → 42883). */
const UNDEFINED_FUNCTION = '42883';

/**
 * The result type PostgreSQL gives the aggregate expression, or `undefined` when
 * it has no such aggregate. Only `undefined_function` reads as refusal — the
 * harness driver normalizes SQLSTATE errors onto `SqlQueryError.sqlState`, and
 * anything else (a missing table's 42P01, a dropped connection, a syntax slip)
 * is rethrown: in the unclaimed direction a swallowed infrastructure error would
 * pass the matrix vacuously.
 */
async function probeResultType(query: Query, expression: string): Promise<string | undefined> {
  try {
    const rows = await query(`SELECT pg_typeof(${expression})::text AS result FROM "${TABLE}"`);
    return String(rows[0]?.['result']);
  } catch (error) {
    if (SqlQueryError.is(error) && error.sqlState === UNDEFINED_FUNCTION) return undefined;
    throw error;
  }
}

/** Whether PostgreSQL considers the aggregate's result type and the expected native type the same type, modifiers aside. */
async function producesExpectedType(
  query: Query,
  expression: string,
  expectedNativeType: string,
): Promise<boolean> {
  const rows = await query(
    `SELECT pg_typeof(${expression}) = pg_typeof(NULL::${expectedNativeType}) AS agrees FROM "${TABLE}"`,
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

            const expression = aggregateSql({
              operation,
              lower: resolved.lower,
              inputCodec: refOf(fixture),
              table: TABLE,
              column: COLUMN,
            });
            const actual = await probeResultType(query, expression);
            if (actual === undefined) {
              disagreements.push({
                operation,
                codecId: fixture.codecId,
                declared: resolved.output.codecId,
                actual: 'PostgreSQL has no such aggregate',
              });
              continue;
            }
            const expected =
              computedTypeFor(operation, fixture.codecId) ?? nativeTypeOf(resolved.output);
            if (!(await producesExpectedType(query, expression, expected))) {
              disagreements.push({
                operation,
                codecId: fixture.codecId,
                declared: `${resolved.output.codecId} (${expected})`,
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

  it('names a computed type only where the declared codec reads one it does not store', () => {
    const redundant = READS_A_COMPUTED_TYPE.filter(({ operation, codecId, computed }) => {
      const resolved = registry.resolve(operation, { codecId });
      return resolved !== undefined && nativeTypeOf(resolved.output) === computed;
    });

    expect(redundant).toEqual([]);
  });

  it(
    'leaves unclaimed only the pairs PostgreSQL refuses',
    async () => {
      const unclaimedButSupported: unknown[] = [];

      for (const fixture of FIXTURES) {
        await withFixtureTable(fixture, async () => {
          for (const operation of BARE_OPERATIONS) {
            if (registry.resolve(operation, refOf(fixture)) !== undefined) continue;

            const actual = await probeResultType(query, `${operation}("${COLUMN}")`);
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

  it('offers each lossless variant over exactly the inputs the policy gives it', () => {
    const claimed = Object.fromEntries(
      Object.keys(LOSSLESS_VARIANT_INPUTS).map((operation) => [
        operation,
        FIXTURES.map((fixture) => fixture.codecId)
          .filter((codecId) => registry.resolve(operation, { codecId }) !== undefined)
          .sort(),
      ]),
    );

    expect(claimed).toEqual(LOSSLESS_VARIANT_INPUTS);
  });

  it('offers the lossless sum over every integer input the bare sum accepts, and over no other', () => {
    const integers = [...integerInputs()].sort();
    const claimed = FIXTURES.map((fixture) => fixture.codecId)
      .filter((codecId) => registry.resolve('sumBigInt', { codecId }) !== undefined)
      .sort();

    expect(integers.length).toBeGreaterThan(0);
    expect(claimed).toEqual(integers);
  });

  it('resolves count and countBigInt with and without an input', () => {
    expect(registry.resolve('count')).toEqual({
      operation: 'count',
      output: { codecId: 'pg/int8number@1' },
      nullable: false,
      emptyResultJson: 0,
      lower: undefined,
    });
    expect(registry.resolve('count', { codecId: 'pg/text@1' })?.output).toEqual({
      codecId: 'pg/int8number@1',
    });

    expect(registry.resolve('countBigInt')).toMatchObject({
      operation: 'countBigInt',
      output: { codecId: 'pg/int8@1' },
      nullable: false,
    });
    expect(registry.resolve('countBigInt', { codecId: 'pg/text@1' })?.output).toEqual({
      codecId: 'pg/int8@1',
    });

    // `countBigInt` computes with `count`, over rows and over values alike.
    expect({
      overRows: aggregateSql({
        operation: 'countBigInt',
        lower: registry.resolve('countBigInt')?.lower,
        inputCodec: undefined,
        table: TABLE,
        column: undefined,
      }),
      overValues: aggregateSql({
        operation: 'countBigInt',
        lower: registry.resolve('countBigInt', { codecId: 'pg/text@1' })?.lower,
        inputCodec: { codecId: 'pg/text@1' },
        table: TABLE,
        column: COLUMN,
      }),
    }).toEqual({
      overRows: 'count(*)',
      overValues: `count("${TABLE}"."${COLUMN}")`,
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

        // A lossless variant reads the same empty-set answer its bare namesake
        // does, so it declares the same nullability.
        expect({
          count: registry.resolve('count')?.nullable,
          countBigInt: registry.resolve('countBigInt')?.nullable,
          sum: registry.resolve('sum', { codecId: 'pg/int4@1' })?.nullable,
          sumBigInt: registry.resolve('sumBigInt', { codecId: 'pg/int4@1' })?.nullable,
          avg: registry.resolve('avg', { codecId: 'pg/int4@1' })?.nullable,
          avgDecimal: registry.resolve('avgDecimal', { codecId: 'pg/int4@1' })?.nullable,
          min: registry.resolve('min', { codecId: 'pg/int4@1' })?.nullable,
        }).toEqual({
          count: false,
          countBigInt: false,
          sum: true,
          sumBigInt: true,
          avg: true,
          avgDecimal: true,
          min: true,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );
});
