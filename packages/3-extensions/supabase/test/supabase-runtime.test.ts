import type { Contract } from '@internal/contract/types';
import { coreHash, profileHash } from '@internal/contract/types';
import {
  type ExecutionStackInstance,
  instantiateExecutionStack,
  type RuntimeDriverInstance,
  type RuntimeExtensionInstance,
} from '@internal/framework-components/execution';
import { SqlStorage } from '@internal/sql-contract/types';
import type { Codec, SqlDriver, SqlExecuteRequest } from '@internal/sql-relational-core/ast';
import {
  BinaryExpr,
  ColumnRef,
  collectOrderedParamRefs,
  ProjectionItem,
  SelectAst as SelectAstCtor,
  TableSource,
} from '@internal/sql-relational-core/ast';
import type { Expression, ScopeField } from '@internal/sql-relational-core/expression';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type {
  SqlMiddleware,
  SqlRuntimeAdapterDescriptor,
  SqlRuntimeAdapterInstance,
  SqlRuntimeTargetDescriptor,
} from '@internal/sql-runtime';
import {
  createExecutionContext,
  createSqlExecutionStack,
  withTransaction,
} from '@internal/sql-runtime';
import { descriptorsFromCodecs } from '@internal/sql-runtime/test/utils';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createTestSqlNamespace } from '../../../2-sql/1-core/contract/test/test-support';
import type { SupabaseRoleBinding } from '../src/runtime/supabase-runtime';
import { SupabaseRuntimeImpl } from '../src/runtime/supabase-runtime';

const testContract: Contract<SqlStorage> = {
  targetFamily: 'sql',
  target: 'postgres',
  profileHash: profileHash('supabase-runtime-test'),
  domain: applicationDomainOf({ models: {} }),
  roots: {},
  storage: new SqlStorage({
    storageHash: coreHash('supabase-runtime-test'),
    namespaces: {
      __unbound__: createTestSqlNamespace({ id: '__unbound__', entries: { table: {} } }),
    },
  }),
  extensions: {},
  capabilities: {},
  meta: {},
};

interface RecordingTransaction {
  readonly id: symbol;
  readonly queryCalls: Array<{
    sql: string;
    params: readonly unknown[] | undefined;
    handle: unknown;
  }>;
  execute: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
}

interface RecordingConnection {
  readonly id: symbol;
  readonly executeCalls: Array<{ sql: string; params: readonly unknown[] | undefined }>;
  readonly queryCalls: Array<{
    sql: string;
    params: readonly unknown[] | undefined;
    handle: unknown;
  }>;
  readonly beginTransactionSpy: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  beginTransaction(): Promise<RecordingTransaction>;
  readonly transaction: RecordingTransaction;
}

interface RecordingDriver {
  readonly acquireConnectionSpy: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  acquireConnection(): Promise<RecordingConnection>;
  readonly connection: RecordingConnection;
}

function createRecordingDriver(
  executeRows: readonly Record<string, unknown>[] = [{ id: 1 }],
): RecordingDriver {
  const txId = Symbol('transaction');
  const connId = Symbol('connection');
  const txQueryCalls: Array<{
    sql: string;
    params: readonly unknown[] | undefined;
    handle: unknown;
  }> = [];
  const connExecuteCalls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  const connQueryCalls: Array<{
    sql: string;
    params: readonly unknown[] | undefined;
    handle: unknown;
  }> = [];

  const transaction: RecordingTransaction = {
    id: txId,
    get queryCalls() {
      return txQueryCalls;
    },
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query: vi.fn().mockImplementation(async function* (request: SqlExecuteRequest) {
      txQueryCalls.push({
        sql: request.sql,
        params: request.params,
        handle: request.preparedStatementHandle,
      });
      for (const row of executeRows) yield row;
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };

  const beginTransactionSpy = vi.fn().mockResolvedValue(transaction);
  const connection: RecordingConnection = {
    id: connId,
    get executeCalls() {
      return connExecuteCalls;
    },
    get queryCalls() {
      return connQueryCalls;
    },
    beginTransactionSpy,
    get transaction() {
      return transaction;
    },
    execute: vi.fn().mockImplementation(async (request: SqlExecuteRequest) => {
      connExecuteCalls.push({ sql: request.sql, params: request.params });
      return { affectedRows: 0 };
    }),
    query: vi.fn().mockImplementation(async function* (request: SqlExecuteRequest) {
      connQueryCalls.push({
        sql: request.sql,
        params: request.params,
        handle: request.preparedStatementHandle,
      });
      for (const row of executeRows) yield row;
    }),
    release: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    beginTransaction: () => beginTransactionSpy(),
  };

  const acquireConnectionSpy = vi.fn().mockResolvedValue(connection);
  const driver: RecordingDriver = {
    acquireConnectionSpy,
    get connection() {
      return connection;
    },
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query: vi.fn().mockImplementation(async function* () {}),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    acquireConnection: () => acquireConnectionSpy(),
  };
  return driver;
}

function createStubAdapter() {
  const codec: Codec<string> = {
    id: 'pg/int4@1',
    targetTypes: ['int4'],
    encode: (v: number) => v,
    decode: (w: number) => w,
  } as unknown as Codec<string>;
  const codecs = [codec];

  return {
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
    __codecs: codecs,
    profile: {
      id: 'test-profile',
      target: 'postgres',
      capabilities: {},
      readMarker: async () => ({ kind: 'absent' as const }),
    },
    lower(ast: Parameters<SqlRuntimeAdapterInstance<'postgres'>['lower']>[0]) {
      const params = [...new Set(ast.collectParamRefs())].map((ref) =>
        ref.kind === 'prepared-param-ref'
          ? { kind: 'bind' as const, name: ref.name }
          : { kind: 'literal' as const, value: ref.value },
      );
      return Object.freeze({ sql: JSON.stringify(ast), params });
    },
  };
}

function createTestAdapterDescriptor(
  adapter: ReturnType<typeof createStubAdapter>,
): SqlRuntimeAdapterDescriptor<'postgres'> {
  const descriptors = descriptorsFromCodecs(adapter.__codecs);
  return {
    kind: 'adapter',
    rawCodecInferer: { inferCodec: () => 'pg/text' },
    id: 'test-adapter',
    version: '0.0.1',
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
    codecs: () => descriptors,
    create() {
      return Object.assign(
        { familyId: 'sql' as const, targetId: 'postgres' as const },
        adapter,
      ) as SqlRuntimeAdapterInstance<'postgres'>;
    },
  };
}

function createTestTargetDescriptor(): SqlRuntimeTargetDescriptor<'postgres'> {
  return {
    kind: 'target',
    id: 'postgres',
    version: '0.0.1',
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
    codecs: () => [],
    create() {
      return { familyId: 'sql' as const, targetId: 'postgres' as const };
    },
  };
}

function createTestSetup(options?: { middleware?: readonly SqlMiddleware[] }) {
  const adapter = createStubAdapter();
  const driver = createRecordingDriver();
  const targetDescriptor = createTestTargetDescriptor();
  const adapterDescriptor = createTestAdapterDescriptor(adapter);

  const stack = createSqlExecutionStack({
    target: targetDescriptor,
    adapter: adapterDescriptor,
    extensions: [],
  });

  type SqlTestStackInstance = ExecutionStackInstance<
    'sql',
    'postgres',
    SqlRuntimeAdapterInstance<'postgres'>,
    RuntimeDriverInstance<'sql', 'postgres'>,
    RuntimeExtensionInstance<'sql', 'postgres'>
  >;
  const stackInstance = instantiateExecutionStack(stack) as unknown as SqlTestStackInstance;

  const context = createExecutionContext({
    contract: testContract,
    stack: { target: targetDescriptor, adapter: adapterDescriptor, extensions: [] },
  });

  const runtimeOptions: ConstructorParameters<typeof SupabaseRuntimeImpl>[0] = {
    context,
    adapter: stackInstance.adapter,
    driver: driver as unknown as SqlDriver,
    verifyMarker: false,
    middleware: options?.middleware ?? [],
  };

  const runtime = new SupabaseRuntimeImpl(runtimeOptions);
  return { runtime, driver };
}

function stubPlan(): SqlExecutionPlan<Record<string, unknown>> {
  return {
    sql: 'select 1',
    params: [],
    ast: SelectAstCtor.from(TableSource.named('stub')),
    meta: {
      target: testContract.target,
      targetFamily: testContract.targetFamily,
      storageHash: testContract.storage.storageHash,
      lane: 'raw',
    },
  };
}

function buildEqUserIdPlan(userId: Expression<ScopeField>): SqlQueryPlan<{ id: number }> {
  const users = TableSource.named('users');
  const ast = SelectAstCtor.from(users)
    .withProjection([
      ProjectionItem.of('id', ColumnRef.of('id', 'users'), { codecId: 'pg/int4@1' }),
    ])
    .withWhere(BinaryExpr.eq(ColumnRef.of('id', 'users'), userId.buildAst()));
  return Object.freeze({
    ast,
    params: collectOrderedParamRefs(ast).map((r) => (r.kind === 'param-ref' ? r.value : undefined)),
    meta: {
      target: testContract.target,
      storageHash: testContract.storage.storageHash,
      lane: 'dsl' as const,
    },
  });
}

describe('SupabaseRuntimeImpl', () => {
  describe('openRoleSession — bind-once', () => {
    it('issues exactly two set_config(…,false) calls before any typed execute', async () => {
      const { runtime, driver } = createTestSetup();
      const binding: SupabaseRoleBinding = { role: 'authenticated', claims: { sub: 'u1' } };

      const session = await runtime.openRoleSession(binding);
      await session.execute(stubPlan()).toArray();
      await session.release();

      const setConfigCalls = driver.connection.executeCalls.filter((c) =>
        c.sql.startsWith('SELECT set_config'),
      );
      expect(setConfigCalls).toEqual([
        { sql: 'SELECT set_config($1, $2, false)', params: ['role', 'authenticated'] },
        {
          sql: 'SELECT set_config($1, $2, false)',
          params: ['request.jwt.claims', JSON.stringify({ sub: 'u1' })],
        },
      ]);
    });

    it('set_config and the typed execute land on the same connection', async () => {
      const { runtime, driver } = createTestSetup();
      const sessionControlOnConn: symbol[] = [];
      const queriedOnConn: symbol[] = [];

      driver.connection.execute = vi.fn().mockImplementation(async (request: SqlExecuteRequest) => {
        sessionControlOnConn.push(driver.connection.id);
        driver.connection.executeCalls.push({ sql: request.sql, params: request.params });
        return { affectedRows: 0 };
      });
      driver.connection.query = vi.fn().mockImplementation(async function* (
        request: SqlExecuteRequest,
      ) {
        queriedOnConn.push(driver.connection.id);
        driver.connection.queryCalls.push({
          sql: request.sql,
          params: request.params,
          handle: request.preparedStatementHandle,
        });
        yield { id: 1 };
      });

      const session = await runtime.openRoleSession({ role: 'anon' });
      await session.execute(stubPlan()).toArray();
      await session.release();

      expect(sessionControlOnConn).toHaveLength(3);
      expect(queriedOnConn).toHaveLength(1);
      expect(sessionControlOnConn[0]).toBe(queriedOnConn[0]);
    });

    it('claims default to {} when not provided', async () => {
      const { runtime, driver } = createTestSetup();

      const session = await runtime.openRoleSession({ role: 'anon' });
      await session.execute(stubPlan()).toArray();
      await session.release();

      const claimsCall = driver.connection.executeCalls.find(
        (c) => (c.params as string[])?.[0] === 'request.jwt.claims',
      );
      expect(claimsCall?.params).toEqual(['request.jwt.claims', '{}']);
    });

    it('empty claims serializes as {}', async () => {
      const { runtime, driver } = createTestSetup();

      const session = await runtime.openRoleSession({ role: 'anon', claims: {} });
      await session.execute(stubPlan()).toArray();
      await session.release();

      const claimsCall = driver.connection.executeCalls.find(
        (c) => (c.params as string[])?.[0] === 'request.jwt.claims',
      );
      expect(claimsCall?.params).toEqual(['request.jwt.claims', '{}']);
    });
  });

  describe('openRoleSession — below-middleware', () => {
    it('registered middleware sees typed executes, not set_config calls', async () => {
      const observedSqls: string[] = [];
      const observer: SqlMiddleware = {
        name: 'sql-observer',
        familyId: 'sql',
        beforeExecute(exec) {
          observedSqls.push(exec.sql);
        },
      };
      const { runtime } = createTestSetup({ middleware: [observer] });

      const session = await runtime.openRoleSession({ role: 'anon' });
      await session.execute(stubPlan()).toArray();
      await session.release();

      // Middleware sees exactly one SQL — the typed execute — not the set_config calls
      expect(observedSqls).toHaveLength(1);
      expect(observedSqls[0]).not.toContain('set_config');
    });
  });

  describe('openRoleSession — stickiness', () => {
    it('multiple executes on the same session use the same connection', async () => {
      const { runtime, driver } = createTestSetup();
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      await session.execute(stubPlan()).toArray();
      await session.execute(stubPlan()).toArray();
      await session.release();

      // acquireConnection called once, not per-execute
      expect(driver.acquireConnectionSpy).toHaveBeenCalledOnce();
    });

    it('transaction() uses the same connection as the session', async () => {
      const { runtime, driver } = createTestSetup();
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      const tx = await session.transaction();
      await tx.commit();
      await session.release();

      expect(driver.connection.beginTransactionSpy).toHaveBeenCalledOnce();
      expect(driver.acquireConnectionSpy).toHaveBeenCalledOnce();
    });
  });

  describe('openRoleSession — release', () => {
    it('release() sends RESET ALL then releases the connection to the pool', async () => {
      const { runtime, driver } = createTestSetup();
      const resetCalls: string[] = [];

      driver.connection.execute = vi.fn().mockImplementation(async (request: SqlExecuteRequest) => {
        driver.connection.executeCalls.push({ sql: request.sql, params: request.params });
        if (request.sql === 'RESET ALL') {
          resetCalls.push(request.sql);
        }
        return { affectedRows: 0 };
      });

      const session = await runtime.openRoleSession({ role: 'anon' });
      await session.release();

      expect(resetCalls).toHaveLength(1);
      expect(driver.connection.release).toHaveBeenCalledOnce();
      expect(driver.connection.destroy).not.toHaveBeenCalled();
    });

    it('when RESET ALL fails, destroys the connection instead of releasing', async () => {
      const { runtime, driver } = createTestSetup();
      const resetError = new Error('RESET ALL failed');

      driver.connection.execute = vi.fn().mockImplementation(async (request: SqlExecuteRequest) => {
        driver.connection.executeCalls.push({ sql: request.sql, params: request.params });
        if (request.sql === 'RESET ALL') {
          throw resetError;
        }
        return { affectedRows: 0 };
      });

      const session = await runtime.openRoleSession({ role: 'anon' });
      await session.release();

      expect(driver.connection.destroy).toHaveBeenCalledOnce();
      expect(driver.connection.release).not.toHaveBeenCalled();
    });
  });

  describe('openRoleSession — bind-failure', () => {
    it('destroys the connection and rethrows when set_config fails', async () => {
      const { runtime, driver } = createTestSetup();
      const bindError = new Error('set_config denied');
      let callCount = 0;

      driver.connection.execute = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw bindError;
        }
        return { affectedRows: 0 };
      });

      await expect(runtime.openRoleSession({ role: 'anon' })).rejects.toBe(bindError);
      expect(driver.connection.destroy).toHaveBeenCalledOnce();
      expect(driver.connection.release).not.toHaveBeenCalled();
    });
  });

  describe('executeWithRole — stream cleanup', () => {
    it('releases the session after the stream drains', async () => {
      const { runtime, driver } = createTestSetup();

      await runtime.executeWithRole(stubPlan(), { role: 'anon' }).toArray();

      // RESET ALL sent, then release called
      const resetCall = driver.connection.executeCalls.find((c) => c.sql === 'RESET ALL');
      expect(resetCall).toBeDefined();
      expect(driver.connection.release).toHaveBeenCalledOnce();
      expect(driver.connection.destroy).not.toHaveBeenCalled();
    });

    it('destroys the session on mid-stream error', async () => {
      const { runtime, driver } = createTestSetup();
      const streamError = new Error('mid-stream failure');

      driver.connection.query = vi.fn().mockReturnValue({
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<unknown>> {
              return Promise.reject(streamError);
            },
          };
        },
      });

      await expect(runtime.executeWithRole(stubPlan(), { role: 'anon' }).toArray()).rejects.toBe(
        streamError,
      );

      expect(driver.connection.destroy).toHaveBeenCalledOnce();
      expect(driver.connection.release).not.toHaveBeenCalled();
    });
  });

  describe('openRoleSession — prepared statements', () => {
    it('executePrepared on the session runs on the session connection', async () => {
      const { runtime, driver } = createTestSetup();
      const ps = await runtime.prepare({ userId: 'pg/int4@1' as const }, (params) =>
        buildEqUserIdPlan(params.userId),
      );
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      const rows = await session.executePrepared(ps, { userId: 1 }).toArray();
      await session.release();

      expect(rows).toEqual([{ id: 1 }]);
      expect(driver.connection.queryCalls).toHaveLength(1);
      expect(driver.connection.queryCalls[0]?.handle).toBeDefined();
      expect(driver.query).not.toHaveBeenCalled();
    });

    it('executePrepared on a session transaction runs on that transaction', async () => {
      const { runtime, driver } = createTestSetup();
      const ps = await runtime.prepare({ userId: 'pg/int4@1' as const }, (params) =>
        buildEqUserIdPlan(params.userId),
      );
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      const tx = await session.transaction();
      const rows = await tx.executePrepared(ps, { userId: 1 }).toArray();
      await tx.commit();
      await session.release();

      expect(rows).toEqual([{ id: 1 }]);
      expect(driver.connection.transaction.queryCalls).toHaveLength(1);
      expect(driver.connection.transaction.queryCalls[0]?.handle).toBeDefined();
      expect(driver.connection.queryCalls).toHaveLength(0);
      expect(driver.query).not.toHaveBeenCalled();
    });
  });

  describe('session transaction — commit and rollback', () => {
    it('commits when the session transaction is committed', async () => {
      const { runtime, driver } = createTestSetup();
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      const tx = await session.transaction();
      await tx.commit();
      await session.release();

      expect(driver.connection.transaction.commit).toHaveBeenCalledOnce();
      expect(driver.connection.transaction.rollback).not.toHaveBeenCalled();
    });

    it('rolls back when the session transaction is rolled back', async () => {
      const { runtime, driver } = createTestSetup();
      const session = await runtime.openRoleSession({ role: 'authenticated' });

      const tx = await session.transaction();
      await tx.rollback();
      await session.release();

      expect(driver.connection.transaction.rollback).toHaveBeenCalledOnce();
      expect(driver.connection.transaction.commit).not.toHaveBeenCalled();
    });

    it('withTransaction over openRoleSession commits on success', async () => {
      const { runtime, driver } = createTestSetup();

      await withTransaction(
        { connection: () => runtime.openRoleSession({ role: 'anon' }) },
        async () => {
          return undefined;
        },
      );

      expect(driver.connection.transaction.commit).toHaveBeenCalledOnce();
      expect(driver.connection.transaction.rollback).not.toHaveBeenCalled();
    });

    it('withTransaction over openRoleSession rolls back on callback throw', async () => {
      const { runtime, driver } = createTestSetup();
      const err = new Error('callback failed');

      await expect(
        withTransaction(
          { connection: () => runtime.openRoleSession({ role: 'anon' }) },
          async () => {
            throw err;
          },
        ),
      ).rejects.toBe(err);

      expect(driver.connection.transaction.rollback).toHaveBeenCalledOnce();
      expect(driver.connection.transaction.commit).not.toHaveBeenCalled();
    });
  });
});
