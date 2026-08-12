import { postgresRawCodecInferer } from '@internal/adapter-postgres/adapter';
import postgresAdapter from '@internal/adapter-postgres/runtime';
import postgresDriver from '@internal/driver-postgres/runtime';
import pgvector from '@internal/extension-pgvector/runtime';
import {
  type ExecutionStackInstance,
  instantiateExecutionStack,
  type RuntimeDriverInstance,
} from '@internal/framework-components/execution';
import { PostgresRuntimeImpl } from '@internal/postgres/runtime';
import { createRawSql, param } from '@internal/sql-relational-core/expression';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import {
  createExecutionContext,
  createSqlExecutionStack,
  type Runtime,
  type SqlRuntimeAdapterInstance,
  type SqlRuntimeDriverInstance,
  type SqlRuntimeExtensionInstance,
} from '@internal/sql-runtime';
import postgresTarget, { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { createDevDatabase, timeouts } from '@repo/test-utils';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contract } from './sql-builder/fixtures/contract';
import type { Contract } from './sql-builder/fixtures/generated/contract';
import { setupTestDatabase } from './utils';

const sqlContract = new PostgresContractSerializer().deserializeContract(contract) as Contract;

type TestStackInstance = ExecutionStackInstance<
  'sql',
  'postgres',
  SqlRuntimeAdapterInstance<'postgres'>,
  RuntimeDriverInstance<'sql', 'postgres'>,
  SqlRuntimeExtensionInstance<'postgres'>
>;

describe('integration: whole-query raw statements', { timeout: timeouts.databaseOperation }, () => {
  let context: ExecutionContext<typeof sqlContract>;
  let driver: SqlRuntimeDriverInstance<'postgres'>;
  let stackInstance: TestStackInstance;
  let runtime: Runtime;
  const closeFns: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    const database = await createDevDatabase();
    const client = new Client({ connectionString: database.connectionString });
    await client.connect();

    await setupTestDatabase(client, sqlContract, async (c) => {
      await c.query(`
          CREATE TABLE users (
            id int4 PRIMARY KEY,
            name text NOT NULL,
            email text NOT NULL,
            invited_by_id int4
          )
        `);
      await c.query(`
          INSERT INTO users (id, name, email, invited_by_id) VALUES
            (1, 'Alice', 'alice@example.com', NULL),
            (2, 'Bob', 'bob@example.com', 1),
            (3, 'Charlie', 'charlie@example.com', 1)
        `);
    });

    const stack = createSqlExecutionStack({
      target: postgresTarget,
      adapter: postgresAdapter,
      driver: {
        ...postgresDriver,
        create() {
          return postgresDriver.create({ cursor: { disabled: true } });
        },
      },
      extensions: [pgvector],
    });

    stackInstance = instantiateExecutionStack(stack) as TestStackInstance;
    context = createExecutionContext({ contract: sqlContract, stack });
    const resolvedDriver = stackInstance.driver;
    if (!resolvedDriver) throw new Error('Driver missing');
    driver = resolvedDriver as SqlRuntimeDriverInstance<'postgres'>;
    await driver.connect({ kind: 'pgClient', client });

    runtime = new PostgresRuntimeImpl({
      context,
      adapter: stackInstance.adapter,
      driver,
      verifyMarker: false,
    });

    closeFns.push(
      () => driver.close(),
      () => client.end(),
      () => database.close(),
    );
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    for (const fn of closeFns) {
      try {
        await fn();
      } catch {
        // ignore cleanup errors
      }
    }
  });

  const rawSql = () => createRawSql(postgresRawCodecInferer, { contract: sqlContract });

  it('decodes the columns the row spec declares', async () => {
    const plan = rawSql()`SELECT id, name FROM users WHERE id > ${1} ORDER BY id`
      .returnsRow({ id: 'pg/int4@1', name: 'pg/text@1' })
      .build();

    const rows = await runtime.query(plan);

    expect(rows).toEqual([
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);
  });

  it('drops result columns the row spec does not declare', async () => {
    const plan = rawSql()`SELECT id, name, email FROM users WHERE id = ${1}`
      .returnsRow({ id: 'pg/int4@1', name: 'pg/text@1' })
      .build();

    const rows = await runtime.query(plan);

    expect(rows).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('reports how many rows a mutation affected', async () => {
    const plan =
      rawSql()`UPDATE users SET name = ${param('Roberta', { codecId: 'pg/text@1' })} WHERE id = ${2}`
        .affectedCount()
        .build();

    const stats = await runtime.execute(plan);

    expect(stats).toEqual({ affectedRows: 1 });
  });

  it('composes a row-returning statement into a CTE', async () => {
    const invited = rawSql()`SELECT id, name FROM users WHERE invited_by_id = ${1}`.returnsRow({
      id: 'pg/int4@1',
      name: 'pg/text@1',
    });

    const plan =
      rawSql()`WITH invited AS (${invited}) SELECT count(*)::int4 AS invited_count FROM invited`
        .returnsRow({ invited_count: 'pg/int4@1' })
        .build();

    const rows = await runtime.query(plan);

    expect(rows).toEqual([{ invited_count: 2 }]);
  });

  it('raises RUNTIME.RAW_ROW_COLUMN_MISSING when the result omits a declared column', async () => {
    const plan = rawSql()`SELECT id FROM users WHERE id = ${1}`
      .returnsRow({ id: 'pg/int4@1', name: 'pg/text@1' })
      .build();

    await expect(runtime.query(plan)).rejects.toMatchObject({
      code: 'RUNTIME.RAW_ROW_COLUMN_MISSING',
      details: { column: 'name' },
    });
  });
});
