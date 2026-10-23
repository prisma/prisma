import type {
  SqlConnection,
  SqlDriver,
  SqlExecuteRequest,
  SqlQueryable,
  SqlTransaction,
} from '@internal/sql-relational-core/ast';
import { RawQueryAst } from '@internal/sql-relational-core/ast';
import type { AffectedCount } from '@internal/sql-relational-core/expression';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { planFromAst } from '@internal/sql-relational-core/plan';
import { describe, expect, it } from 'vitest';
import type { RuntimeQueryable } from '../src/sql-runtime';
import {
  collectAsync,
  createStubAdapter,
  createTestContext,
  createTestContract,
  createTestRuntime,
  createTestStackInstance,
  stubAst,
} from './utils';

const contract = createTestContract({ storageHash: 'contains-raw-sql-routing' });

interface Sent {
  readonly via: 'driver' | 'connection' | 'transaction';
  readonly method: 'query' | 'execute';
  readonly containsRawSql: boolean;
}

function createRecordingDriver(sent: Sent[]): SqlDriver {
  const queryable = (via: Sent['via']): SqlQueryable => ({
    async *query<Row>(request: SqlExecuteRequest): AsyncIterable<Row> {
      sent.push({ via, method: 'query', containsRawSql: request.containsRawSql });
      yield* [];
    },
    async execute(request: SqlExecuteRequest) {
      sent.push({ via, method: 'execute', containsRawSql: request.containsRawSql });
      return { affectedRows: 0 };
    },
  });
  const transaction: SqlTransaction = {
    ...queryable('transaction'),
    commit: async () => {},
    rollback: async () => {},
  };
  const connection: SqlConnection = {
    ...queryable('connection'),
    beginTransaction: async () => transaction,
    release: async () => {},
    destroy: async () => {},
  };
  return {
    ...queryable('driver'),
    connect: async () => {},
    acquireConnection: async () => connection,
    close: async () => {},
  };
}

function setup() {
  const sent: Sent[] = [];
  const runtime = createTestRuntime({
    stackInstance: createTestStackInstance(),
    context: createTestContext(contract, createStubAdapter()),
    driver: createRecordingDriver(sent),
    verifyMarker: false,
  });
  return { runtime, sent };
}

const rawRows = (): SqlQueryPlan<Record<string, unknown>> =>
  planFromAst(RawQueryAst.rows(['select @@session.time_zone'], {}), contract);
const rawStatement = (): SqlQueryPlan<AffectedCount> =>
  planFromAst(RawQueryAst.affectedCount(["SET time_zone = '+05:00'"]), contract);
const builtStatement = (): SqlQueryPlan<unknown> => planFromAst(stubAst(), contract);

type Runtime = ReturnType<typeof setup>['runtime'];

async function sendEach(runtime: Runtime, on: RuntimeQueryable): Promise<void> {
  await collectAsync(on.query(rawRows()));
  await collectAsync(on.query(builtStatement()));
  await on.execute(rawStatement());
  await on.execute(builtStatement());
  const preparedRawRows = await runtime.prepare({}, () => rawRows());
  const preparedBuilt = await runtime.prepare({}, () => builtStatement());
  const preparedRawStatement = await runtime.prepare({}, () => rawStatement());
  await collectAsync(preparedRawRows.query(on, {}));
  await collectAsync(preparedBuilt.query(on, {}));
  await preparedRawStatement.execute(on, {});
}

/** The plain paths, then the prepared ones. Only a raw statement prepares into a handle that executes. */
const eachPathWithAndWithoutRawSql = (via: Sent['via']): Sent[] => [
  { via, method: 'query', containsRawSql: true },
  { via, method: 'query', containsRawSql: false },
  { via, method: 'execute', containsRawSql: true },
  { via, method: 'execute', containsRawSql: false },
  { via, method: 'query', containsRawSql: true },
  { via, method: 'query', containsRawSql: false },
  { via, method: 'execute', containsRawSql: true },
];

describe('whether a statement contains raw SQL, as the driver receives it', () => {
  it('reaches the driver on the plain and prepared query and execute paths', async () => {
    const { runtime, sent } = setup();

    await sendEach(runtime, runtime);

    expect(sent).toEqual(eachPathWithAndWithoutRawSql('driver'));
  });

  it('reaches a held connection', async () => {
    const { runtime, sent } = setup();
    const connection = await runtime.connection();

    await sendEach(runtime, connection);
    await connection.release();

    expect(sent).toEqual(eachPathWithAndWithoutRawSql('connection'));
  });

  it('reaches a transaction', async () => {
    const { runtime, sent } = setup();
    const connection = await runtime.connection();
    const transaction = await connection.transaction();

    await sendEach(runtime, transaction);
    await transaction.commit();
    await connection.release();

    expect(sent).toEqual(eachPathWithAndWithoutRawSql('transaction'));
  });

  it('is read from the AST of a plan that arrives already lowered', async () => {
    const { runtime, sent } = setup();
    const lowered = (plan: SqlQueryPlan<unknown>): SqlExecutionPlan => ({
      sql: 'SELECT 1',
      params: [],
      ast: plan.ast,
      meta: plan.meta,
    });

    await runtime.execute(lowered(rawStatement()));
    await runtime.execute(lowered(builtStatement()));

    expect(sent).toEqual([
      { via: 'driver', method: 'execute', containsRawSql: true },
      { via: 'driver', method: 'execute', containsRawSql: false },
    ]);
  });
});
