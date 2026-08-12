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
  LiteralExpr,
  ParamRef,
  ProjectionItem,
  SelectAst,
  TableSource,
} from '@internal/sql-relational-core/ast';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { applicationDomainOf, timeouts } from '@repo/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createTestSqlNamespace } from '../../1-core/contract/test/test-support';
import type { SqlMiddleware } from '../src/middleware/sql-middleware';
import type {
  SqlRuntimeAdapterDescriptor,
  SqlRuntimeAdapterInstance,
  SqlRuntimeTargetDescriptor,
} from '../src/sql-context';
import { createExecutionContext, createSqlExecutionStack } from '../src/sql-context';
import { withTransaction } from '../src/sql-runtime';
import { createAsyncSecretCodec, decryptSecret } from './seeded-secret-codec';
import { defineTestCodec } from './test-codec';
import { createTestRuntime as createRuntime, descriptorsFromCodecs, stubAst } from './utils';

const runtimeSecretSeed = 'sql-runtime-secret';

const testContract: Contract<SqlStorage> = {
  targetFamily: 'sql',
  target: 'postgres',
  profileHash: profileHash('test'),
  domain: applicationDomainOf({ models: {} }),
  roots: {},
  storage: new SqlStorage({
    storageHash: coreHash('test'),
    namespaces: {
      __unbound__: createTestSqlNamespace({ id: '__unbound__', entries: { table: {} } }),
    },
  }),
  extensions: {},
  capabilities: {},
  meta: {},
};

interface DriverMockSpies {
  rootExecute: ReturnType<typeof vi.fn>;
  connectionExecute: ReturnType<typeof vi.fn>;
  transactionExecute: ReturnType<typeof vi.fn>;
  connectionRelease: ReturnType<typeof vi.fn>;
  connectionDestroy: ReturnType<typeof vi.fn>;
  transactionCommit: ReturnType<typeof vi.fn>;
  transactionRollback: ReturnType<typeof vi.fn>;
  driverClose: ReturnType<typeof vi.fn>;
}

type MockSqlDriver = SqlDriver & { __spies: DriverMockSpies };

function createStubCodecs(
  extraCodecs: readonly Codec<string>[] = [],
): ReadonlyArray<Codec<string>> {
  return [
    defineTestCodec({
      typeId: 'pg/int4@1',
      targetTypes: ['int4'],
      encode: (v: number) => v,
      decode: (w: number) => w,
    }),
    ...extraCodecs,
  ];
}

function createStubAdapter(extraCodecs: readonly Codec<string>[] = []) {
  const codecs = createStubCodecs(extraCodecs);
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
    lower(ast: SelectAst) {
      const params = [...new Set(ast.collectParamRefs())].map((ref) =>
        ref.kind === 'prepared-param-ref'
          ? { kind: 'bind' as const, name: ref.name }
          : { kind: 'literal' as const, value: ref.value },
      );
      return Object.freeze({ sql: JSON.stringify(ast), params });
    },
  };
}

function createMockDriver(): MockSqlDriver {
  const rootExecute = vi.fn().mockImplementation(async function* (_request: SqlExecuteRequest) {
    yield { id: 1 };
  });
  const connectionExecute = vi.fn().mockImplementation(async function* (
    _request: SqlExecuteRequest,
  ) {
    yield { id: 2 };
  });
  const transactionExecute = vi.fn().mockImplementation(async function* (
    _request: SqlExecuteRequest,
  ) {
    yield { id: 3 };
  });

  const transaction = {
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query: transactionExecute,
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };

  const connection = {
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query: connectionExecute,
    release: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    beginTransaction: vi.fn().mockResolvedValue(transaction),
  };

  const driverClose = vi.fn().mockResolvedValue(undefined);

  const driver: SqlDriver = {
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query: rootExecute,
    connect: vi.fn().mockImplementation(async (_binding?: undefined) => undefined),
    acquireConnection: vi.fn().mockResolvedValue(connection),
    close: driverClose,
  };

  return Object.assign(driver, {
    __spies: {
      rootExecute,
      connectionExecute,
      transactionExecute,
      connectionRelease: connection.release,
      connectionDestroy: connection.destroy,
      transactionCommit: transaction.commit,
      transactionRollback: transaction.rollback,
      driverClose,
    },
  });
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

function createTestAdapterDescriptor(
  adapter: ReturnType<typeof createStubAdapter>,
): SqlRuntimeAdapterDescriptor<'postgres'> {
  const codecRegistry = adapter.__codecs;
  return {
    kind: 'adapter',
    rawCodecInferer: { inferCodec: () => 'pg/text' },
    id: 'test-adapter',
    version: '0.0.1',
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
    codecs: () => descriptorsFromCodecs(codecRegistry),
    create() {
      return Object.assign(
        { familyId: 'sql' as const, targetId: 'postgres' as const },
        adapter,
      ) as SqlRuntimeAdapterInstance<'postgres'>;
    },
  };
}

function createTestSetup(options?: { extraCodecs?: readonly Codec<string>[] }) {
  const adapter = createStubAdapter(options?.extraCodecs ?? []);
  const driver = createMockDriver();

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
  const stackInstance = instantiateExecutionStack(stack) as SqlTestStackInstance;

  const context = createExecutionContext({
    contract: testContract,
    stack: { target: targetDescriptor, adapter: adapterDescriptor, extensions: [] },
  });

  return { stackInstance, context, driver };
}

function createRawExecutionPlan<Row = Record<string, unknown>>(
  overrides?: Partial<SqlExecutionPlan<Row>>,
): SqlExecutionPlan<Row> {
  const metaOverrides = overrides?.meta;
  return {
    sql: 'select 1',
    params: [],
    ast: stubAst(),
    ...overrides,
    meta: {
      target: testContract.target,
      targetFamily: testContract.targetFamily,
      storageHash: testContract.storage.storageHash,
      lane: 'raw',
      ...metaOverrides,
    },
  };
}

describe('SqlRuntime', () => {
  it('creates runtime with context and driver', () => {
    const { stackInstance, context, driver } = createTestSetup();

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    expect(runtime).toBeDefined();
    expect(runtime.execute).toBeDefined();
    expect(runtime.telemetry).toBeDefined();
    expect(runtime.close).toBeDefined();
  });

  it('returns null telemetry when no events', () => {
    const { stackInstance, context, driver } = createTestSetup();

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    expect(runtime.telemetry()).toBeNull();
  });

  it('closes runtime and driver', async () => {
    const { stackInstance, context, driver } = createTestSetup();

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    await runtime.close();
    expect(driver.close).toHaveBeenCalled();
  });

  it('creates runtime with default verifyMarker behaviour when the option is omitted', () => {
    const { stackInstance, context, driver } = createTestSetup();

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
    });

    expect(runtime).toBeDefined();
  });

  it('uses acquired connection queryable for connection.execute', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    const connection = await runtime.connection();
    await connection.execute(createRawExecutionPlan()).toArray();

    expect(driver.__spies.connectionExecute).toHaveBeenCalledTimes(1);
    expect(driver.__spies.transactionExecute).not.toHaveBeenCalled();
    expect(driver.__spies.rootExecute).not.toHaveBeenCalled();

    await connection.release();
  });

  it('delegates connection.destroy() to the driver connection', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    const connection = await runtime.connection();
    const reason = new Error('bad state');
    await connection.destroy(reason);

    expect(driver.__spies.connectionDestroy).toHaveBeenCalledOnce();
    expect(driver.__spies.connectionDestroy).toHaveBeenCalledWith(reason);
    expect(driver.__spies.connectionRelease).not.toHaveBeenCalled();
  });

  it('uses transaction queryable for transaction.execute', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    const connection = await runtime.connection();
    const transaction = await connection.transaction();
    await transaction.execute(createRawExecutionPlan()).toArray();

    expect(driver.__spies.transactionExecute).toHaveBeenCalledTimes(1);
    expect(driver.__spies.connectionExecute).not.toHaveBeenCalled();
    expect(driver.__spies.rootExecute).not.toHaveBeenCalled();

    await transaction.rollback();
    await connection.release();
  });

  it('keeps root execute on driver queryable for runtime.execute', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    await runtime.execute(createRawExecutionPlan()).toArray();

    expect(driver.__spies.rootExecute).toHaveBeenCalledTimes(1);
    expect(driver.__spies.connectionExecute).not.toHaveBeenCalled();
    expect(driver.__spies.transactionExecute).not.toHaveBeenCalled();
  });

  it('accepts a generic middleware (no familyId)', () => {
    const { stackInstance, context, driver } = createTestSetup();
    expect(() =>
      createRuntime({
        stackInstance,
        context,
        driver,
        verifyMarker: false,
        middleware: [{ name: 'generic' }],
      }),
    ).not.toThrow();
  });

  it('accepts an SQL middleware', () => {
    const { stackInstance, context, driver } = createTestSetup();
    expect(() =>
      createRuntime({
        stackInstance,
        context,
        driver,
        verifyMarker: false,
        middleware: [{ name: 'sql-lints', familyId: 'sql' }],
      }),
    ).not.toThrow();
  });

  it('rejects a Mongo middleware with a clear error', () => {
    const { stackInstance, context, driver } = createTestSetup();
    // Simulate a caller bypassing the SqlMiddleware type constraint (e.g. dynamically-loaded middleware). Static typing already rejects familyId: 'mongo'; this tests the runtime guard.
    const mongoMiddleware = { name: 'mongo-mw', familyId: 'mongo' } as unknown as SqlMiddleware;
    expect(() =>
      createRuntime({
        stackInstance,
        context,
        driver,
        verifyMarker: false,
        middleware: [mongoMiddleware],
      }),
    ).toThrow(
      "Middleware 'mongo-mw' requires family 'mongo' but the runtime is configured for family 'sql'",
    );
  });

  it('invokes beforeCompile and lowers the rewritten AST', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const debug = vi.fn();
    const softDeletePredicate = BinaryExpr.eq(
      ColumnRef.of('users', 'deleted_at'),
      LiteralExpr.of(null),
    );
    const softDelete: SqlMiddleware = {
      name: 'softDelete',
      familyId: 'sql',
      async beforeCompile(draft) {
        if (draft.ast.kind !== 'select') return;
        return { ...draft, ast: draft.ast.withWhere(softDeletePredicate) };
      },
    };

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
      middleware: [softDelete],
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug },
    });

    const queryPlan: SqlQueryPlan = {
      ast: SelectAst.from(TableSource.named('users')).withProjection([]),
      params: [],
      meta: {
        target: 'postgres',
        storageHash: testContract.storage.storageHash,
        lane: 'dsl',
      },
    };

    await runtime.execute(queryPlan).toArray();

    expect(driver.__spies.rootExecute).toHaveBeenCalledTimes(1);
    const request = driver.__spies.rootExecute.mock.calls[0]?.[0] as SqlExecuteRequest;
    expect(request.sql).toContain('deleted_at');
    expect(debug).toHaveBeenCalledWith({
      event: 'middleware.rewrite',
      middleware: 'softDelete',
      lane: 'dsl',
    });
  });

  it('invokes adapter.lower exactly once per execute regardless of chain length', async () => {
    const adapter = createStubAdapter();
    const lowerSpy = vi.spyOn(adapter, 'lower');
    const driver = createMockDriver();

    const targetDescriptor = createTestTargetDescriptor();
    const adapterDescriptor = createTestAdapterDescriptor(adapter);
    const stack = createSqlExecutionStack({
      target: targetDescriptor,
      adapter: adapterDescriptor,
      extensions: [],
    });
    const stackInstance = instantiateExecutionStack(stack) as ExecutionStackInstance<
      'sql',
      'postgres',
      SqlRuntimeAdapterInstance<'postgres'>,
      RuntimeDriverInstance<'sql', 'postgres'>,
      RuntimeExtensionInstance<'sql', 'postgres'>
    >;
    const context = createExecutionContext({
      contract: testContract,
      stack: { target: targetDescriptor, adapter: adapterDescriptor, extensions: [] },
    });

    const rewriteA: SqlMiddleware = {
      name: 'rewriteA',
      familyId: 'sql',
      async beforeCompile(draft) {
        if (draft.ast.kind !== 'select') return undefined;
        return {
          ...draft,
          ast: draft.ast.withWhere(BinaryExpr.eq(ColumnRef.of('users', 'a'), LiteralExpr.of(1))),
        };
      },
    };
    const rewriteB: SqlMiddleware = {
      name: 'rewriteB',
      familyId: 'sql',
      async beforeCompile(draft) {
        if (draft.ast.kind !== 'select') return undefined;
        return {
          ...draft,
          ast: draft.ast.withWhere(BinaryExpr.eq(ColumnRef.of('users', 'b'), LiteralExpr.of(2))),
        };
      },
    };

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
      middleware: [rewriteA, rewriteB],
    });

    const queryPlan: SqlQueryPlan = {
      ast: SelectAst.from(TableSource.named('users')).withProjection([]),
      params: [],
      meta: {
        target: 'postgres',
        storageHash: testContract.storage.storageHash,
        lane: 'dsl',
      },
    };

    await runtime.execute(queryPlan).toArray();

    expect(lowerSpy).toHaveBeenCalledTimes(1);
    const loweredAst = lowerSpy.mock.calls[0]?.[0] as SelectAst;
    expect(loweredAst.where?.kind).toBe('binary');
  });

  it('skips beforeCompile for raw execution plans with no AST', async () => {
    const { stackInstance, context, driver } = createTestSetup();
    const debug = vi.fn();
    const beforeCompile = vi.fn();
    const observer: SqlMiddleware = {
      name: 'observer',
      familyId: 'sql',
      beforeCompile,
    };

    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
      middleware: [observer],
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug },
    });

    await runtime.execute(createRawExecutionPlan()).toArray();

    expect(beforeCompile).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
  });

  it('awaits async parameter encoding before driver execution', {
    timeout: timeouts.databaseOperation,
  }, async () => {
    const asyncSecretCodec = createAsyncSecretCodec({
      typeId: 'test/async-secret@1',
      seed: runtimeSecretSeed,
    });
    const { stackInstance, context, driver } = createTestSetup({
      extraCodecs: [asyncSecretCodec],
    });
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    const ast = SelectAst.from(TableSource.named('users'))
      .withProjection([ProjectionItem.of('id', ColumnRef.of('users', 'id'))])
      .withWhere(
        BinaryExpr.eq(
          ColumnRef.of('users', 'name'),
          ParamRef.of('Alice', { name: 'secret', codec: { codecId: 'test/async-secret@1' } }),
        ),
      );
    const plan: SqlQueryPlan = {
      ast,
      params: ['Alice'],
      meta: {
        target: testContract.target,
        targetFamily: testContract.targetFamily,
        storageHash: testContract.storage.storageHash,
        lane: 'dsl',
      },
    };

    await runtime.execute(plan).toArray();

    expect(driver.__spies.rootExecute).toHaveBeenCalledOnce();
    const sentRequest = driver.__spies.rootExecute.mock.calls[0]?.[0] as
      | { params?: readonly unknown[] }
      | undefined;
    const sentSecret = sentRequest?.params?.[0];
    expect(typeof sentSecret).toBe('string');
    expect(sentSecret).not.toBe('Alice');
    await expect(decryptSecret(sentSecret as string, runtimeSecretSeed)).resolves.toBe('Alice');
  });

  it('wraps async parameter encoding failures before the driver runs', async () => {
    const failingCodec = defineTestCodec({
      typeId: 'test/failing-secret@1',
      targetTypes: ['text'],
      encode: async (_value: string) => {
        throw new Error('encrypt failed');
      },
      decode: (wire: string) => wire,
    });
    const { stackInstance, context, driver } = createTestSetup({
      extraCodecs: [failingCodec],
    });
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });

    const ast = SelectAst.from(TableSource.named('users'))
      .withProjection([ProjectionItem.of('id', ColumnRef.of('users', 'id'))])
      .withWhere(
        BinaryExpr.eq(
          ColumnRef.of('users', 'name'),
          ParamRef.of('Alice', { name: 'secret', codec: { codecId: 'test/failing-secret@1' } }),
        ),
      );
    const plan: SqlQueryPlan = {
      ast,
      params: ['Alice'],
      meta: {
        target: testContract.target,
        targetFamily: testContract.targetFamily,
        storageHash: testContract.storage.storageHash,
        lane: 'dsl',
      },
    };

    await expect(runtime.execute(plan).toArray()).rejects.toMatchObject({
      code: 'RUNTIME.ENCODE_FAILED',
      details: expect.objectContaining({
        label: 'secret',
        codec: 'test/failing-secret@1',
      }),
    });
    expect(driver.__spies.rootExecute).not.toHaveBeenCalled();
  });
});

describe('withTransaction', () => {
  function createRuntimeForTransaction() {
    const { stackInstance, context, driver } = createTestSetup();
    const runtime = createRuntime({
      stackInstance,
      context,
      driver,
      verifyMarker: false,
    });
    return { runtime, driver };
  }

  it('commits on successful callback and returns the result', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    const result = await withTransaction(runtime, async (tx) => {
      await tx.execute(createRawExecutionPlan()).toArray();
      return 42;
    });

    expect(result).toBe(42);
    expect(driver.__spies.transactionCommit).toHaveBeenCalledOnce();
    expect(driver.__spies.transactionRollback).not.toHaveBeenCalled();
    expect(driver.__spies.connectionRelease).toHaveBeenCalledOnce();
  });

  it('rolls back on callback error and re-throws', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const error = new Error('test error');

    await expect(
      withTransaction(runtime, async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(driver.__spies.transactionRollback).toHaveBeenCalledOnce();
    expect(driver.__spies.transactionCommit).not.toHaveBeenCalled();
    expect(driver.__spies.connectionRelease).toHaveBeenCalledOnce();
  });

  it('releases connection after commit', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    await withTransaction(runtime, async () => 'ok');

    expect(driver.__spies.connectionRelease).toHaveBeenCalledOnce();
  });

  it('releases connection after rollback', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    await withTransaction(runtime, async () => {
      throw new Error('fail');
    }).catch(() => {});

    expect(driver.__spies.connectionRelease).toHaveBeenCalledOnce();
  });

  it('wraps commit failure and exposes the original error as cause', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const commitError = new Error('commit failed');
    driver.__spies.transactionCommit.mockRejectedValueOnce(commitError);

    const result = withTransaction(runtime, async () => 'value');

    await expect(result).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_COMMIT_FAILED',
      cause: commitError,
    });
  });

  it('attempts best-effort rollback after commit fails and releases when it succeeds', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const commitError = new Error('commit failed');
    driver.__spies.transactionCommit.mockRejectedValueOnce(commitError);

    await withTransaction(runtime, async () => 'value').catch(() => {});

    expect(driver.__spies.transactionCommit).toHaveBeenCalledOnce();
    expect(driver.__spies.transactionRollback).toHaveBeenCalledOnce();
    // A successful rollback after a failed commit means the server is no longer in a transaction and the connection round-tripped cleanly, so it is safe to return to the pool rather than evict it.
    expect(driver.__spies.connectionRelease).toHaveBeenCalledOnce();
    expect(driver.__spies.connectionDestroy).not.toHaveBeenCalled();
  });

  it('forwards the callback return value', async () => {
    const { runtime } = createRuntimeForTransaction();

    const result = await withTransaction(runtime, async () => ({
      name: 'test',
      count: 3,
    }));

    expect(result).toEqual({ name: 'test', count: 3 });
  });

  it('executes queries against the transaction', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    await withTransaction(runtime, async (tx) => {
      await tx.execute(createRawExecutionPlan()).toArray();
    });

    expect(driver.__spies.transactionExecute).toHaveBeenCalledOnce();
    expect(driver.__spies.rootExecute).not.toHaveBeenCalled();
    expect(driver.__spies.connectionExecute).not.toHaveBeenCalled();
  });

  it('throws on execute after commit (invalidation)', async () => {
    const { runtime } = createRuntimeForTransaction();
    let savedTx: { execute: (plan: SqlExecutionPlan) => unknown } | undefined;

    await withTransaction(runtime, async (tx) => {
      savedTx = tx;
    });

    expect(() => savedTx!.execute(createRawExecutionPlan())).toThrow(
      'Cannot read from a query result after the transaction has ended',
    );
  });

  it('throws on iteration of escaped AsyncIterableResult after commit', async () => {
    const { runtime } = createRuntimeForTransaction();

    const escaped = await withTransaction(runtime, async (tx) => {
      return { result: tx.execute(createRawExecutionPlan()) };
    });

    await expect(escaped.result.toArray()).rejects.toThrow(
      'Cannot read from a query result after the transaction has ended',
    );
  });

  it('rejects escaped result with TRANSACTION_CLOSED without consulting the driver', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    let driverBodyEntered = false;
    driver.__spies.transactionExecute.mockImplementationOnce(async function* () {
      driverBodyEntered = true;
      yield { id: 99 };
    });

    const escaped = await withTransaction(runtime, async (tx) => {
      return { result: tx.execute(createRawExecutionPlan()) };
    });

    await expect(escaped.result.toArray()).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_CLOSED',
    });
    expect(driverBodyEntered).toBe(false);
  });

  it('rejects partially-consumed escaped iterator on resume without consulting the driver', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    let driverNextCallCount = 0;
    driver.__spies.transactionExecute.mockImplementationOnce(async function* () {
      driverNextCallCount++;
      yield { id: 1 };
      driverNextCallCount++;
      yield { id: 2 };
    });

    // Escape a partially-consumed iterator: pull the first row inside the transaction, then let it commit.
    const escapedIterator = await withTransaction(runtime, async (tx) => {
      const iter = tx.execute(createRawExecutionPlan())[Symbol.asyncIterator]();
      await iter.next(); // pulls row 1 — driver body entered, driverNextCallCount === 1
      return iter;
    });

    const countAfterPartialConsumption = driverNextCallCount;

    // Now the transaction is committed (invalidated). Calling next() must throw TRANSACTION_CLOSED,
    // not advance into the driver for the second row.
    await expect(escapedIterator.next()).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_CLOSED',
    });
    expect(driverNextCallCount).toBe(countAfterPartialConsumption);
  });

  it('sets invalidated flag after commit', async () => {
    const { runtime } = createRuntimeForTransaction();
    let txRef: { invalidated: boolean } | undefined;

    await withTransaction(runtime, async (tx) => {
      expect(tx.invalidated).toBe(false);
      txRef = tx;
    });

    expect(txRef!.invalidated).toBe(true);
  });

  it('wraps original error when rollback fails', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const callbackError = new Error('callback failed');
    const rollbackError = new Error('rollback failed');
    driver.__spies.transactionRollback.mockRejectedValueOnce(rollbackError);

    const rejection = withTransaction(runtime, async () => {
      throw callbackError;
    });

    await expect(rejection).rejects.toThrow('Transaction rollback failed after callback error');
    await expect(rejection).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_ROLLBACK_FAILED',
      cause: callbackError,
      details: { rollbackError },
    });
    expect(driver.__spies.connectionDestroy).toHaveBeenCalledOnce();
    expect(driver.__spies.connectionRelease).not.toHaveBeenCalled();
  });

  it('destroys connection when rollback fails even if destroy also fails', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const callbackError = new Error('callback failed');
    const rollbackError = new Error('rollback failed');
    const destroyError = new Error('destroy failed');
    driver.__spies.transactionRollback.mockRejectedValueOnce(rollbackError);
    driver.__spies.connectionDestroy.mockRejectedValueOnce(destroyError);

    const rejection = withTransaction(runtime, async () => {
      throw callbackError;
    });

    await expect(rejection).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_ROLLBACK_FAILED',
      cause: callbackError,
      details: { rollbackError },
    });
    expect(driver.__spies.connectionDestroy).toHaveBeenCalledOnce();
    expect(driver.__spies.connectionRelease).not.toHaveBeenCalled();
  });

  it('destroys connection when commit fails and best-effort rollback also fails', async () => {
    const { runtime, driver } = createRuntimeForTransaction();
    const commitError = new Error('commit failed');
    const rollbackError = new Error('rollback also failed');
    driver.__spies.transactionCommit.mockRejectedValueOnce(commitError);
    driver.__spies.transactionRollback.mockRejectedValueOnce(rollbackError);

    const rejection = withTransaction(runtime, async () => 'value');

    await expect(rejection).rejects.toMatchObject({
      code: 'RUNTIME.TRANSACTION_COMMIT_FAILED',
      cause: commitError,
    });
    expect(driver.__spies.connectionDestroy).toHaveBeenCalledOnce();
    expect(driver.__spies.connectionRelease).not.toHaveBeenCalled();
  });

  it('sets invalidated flag after rollback', async () => {
    const { runtime } = createRuntimeForTransaction();
    let txRef: { invalidated: boolean } | undefined;

    await withTransaction(runtime, async (tx) => {
      txRef = tx;
      throw new Error('fail');
    }).catch(() => {});

    expect(txRef!.invalidated).toBe(true);
  });

  it('releases connection independently across sequential transactions', async () => {
    const { runtime, driver } = createRuntimeForTransaction();

    await withTransaction(runtime, async (tx) => {
      await tx.execute(createRawExecutionPlan()).toArray();
    });

    await withTransaction(runtime, async (tx) => {
      await tx.execute(createRawExecutionPlan()).toArray();
    });

    await withTransaction(runtime, async () => {
      throw new Error('fail');
    }).catch(() => {});

    expect(driver.__spies.connectionRelease).toHaveBeenCalledTimes(3);
    expect(driver.__spies.transactionCommit).toHaveBeenCalledTimes(2);
    expect(driver.__spies.transactionRollback).toHaveBeenCalledTimes(1);
  });
});
