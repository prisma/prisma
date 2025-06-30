import {
  BatchResponse,
  CompactedBatchResponse,
  QueryCompiler,
  QueryCompilerConstructor,
  QueryEngineLogLevel,
} from '@prisma/client-common'
import {
  doKeysMatch,
  QueryEvent,
  QueryInterpreter,
  QueryInterpreterTransactionManager,
  QueryPlanNode,
  safeJsonStringify,
  TransactionInfo,
  TransactionManager,
  UserFacingError,
} from '@prisma/client-engine-runtime'
import { Debug } from '@prisma/debug'
import type {
  IsolationLevel as SqlIsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { assertNever, TracingHelper } from '@prisma/internals'

import { version as clientVersion } from '../../../../../package.json'
import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { deserializeJsonResponse } from '../../jsonProtocol/deserializeJsonResponse'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import { Engine } from '../common/Engine'
import { LogEmitter, QueryEvent as ClientQueryEvent } from '../common/types/Events'
import { JsonQuery } from '../common/types/JsonProtocol'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { RustRequestError, SyncRustError } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { InteractiveTransactionInfo } from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { QueryCompilerLoader } from './types/QueryCompiler'
import { wasmQueryCompilerLoader } from './WasmQueryCompilerLoader'

const CLIENT_ENGINE_ERROR = 'P2038'

const debug = Debug('prisma:client:clientEngine')

type GlobalWithPanicHandler = typeof globalThis & {
  PRISMA_WASM_PANIC_REGISTRY: {
    set_message?: (message: string) => void
  }
}

const globalWithPanicHandler = globalThis as GlobalWithPanicHandler

// The fallback panic handler shared across all instances. This ensures that any
// panic is caught and handled, but each instance should prefer temporarily
// setting its own local panic handler for the duration of a synchronous WASM
// function call for better error messages.
globalWithPanicHandler.PRISMA_WASM_PANIC_REGISTRY = {
  set_message(message: string) {
    throw new PrismaClientRustPanicError(message, clientVersion)
  },
}

interface ConnectedEngine {
  driverAdapter: SqlDriverAdapter
  transactionManager: TransactionManager
  queryCompiler: QueryCompiler
}

type EngineState =
  | {
      type: 'disconnected'
    }
  | {
      type: 'connecting'
      promise: Promise<ConnectedEngine>
    }
  | {
      type: 'connected'
      engine: ConnectedEngine
    }
  | {
      type: 'disconnecting'
      promise: Promise<void>
    }

export class ClientEngine implements Engine<undefined> {
  name = 'ClientEngine' as const

  #QueryCompilerConstructor?: QueryCompilerConstructor
  #state: EngineState = { type: 'disconnected' }
  #driverAdapterFactory: SqlDriverAdapterFactory
  #queryCompilerLoader: QueryCompilerLoader

  config: EngineConfig
  datamodel: string

  logEmitter: LogEmitter
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  tracingHelper: TracingHelper

  #emitQueryEvent?: (event: QueryEvent) => void

  constructor(config: EngineConfig, queryCompilerLoader?: QueryCompilerLoader) {
    if (!config.previewFeatures?.includes('driverAdapters')) {
      throw new PrismaClientInitializationError(
        'EngineType `client` requires the driverAdapters preview feature to be enabled.',
        config.clientVersion,
        CLIENT_ENGINE_ERROR,
      )
    }
    if (!config.adapter) {
      throw new PrismaClientInitializationError(
        'Missing configured driver adapter. Engine type `client` requires an active driver adapter. Please check your PrismaClient initialization code.',
        config.clientVersion,
        CLIENT_ENGINE_ERROR,
      )
    } else {
      this.#driverAdapterFactory = config.adapter
      debug('Using driver adapter: %O', config.adapter)
    }

    if (TARGET_BUILD_TYPE === 'client' || TARGET_BUILD_TYPE === 'wasm-compiler-edge') {
      this.#queryCompilerLoader = queryCompilerLoader ?? wasmQueryCompilerLoader
    } else {
      throw new Error(`Invalid TARGET_BUILD_TYPE: ${TARGET_BUILD_TYPE}`)
    }

    this.config = config
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = config.logEmitter
    this.datamodel = config.inlineSchema
    this.tracingHelper = config.tracingHelper

    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
    }

    if (this.logQueries) {
      this.#emitQueryEvent = (event: QueryEvent) => {
        this.logEmitter.emit('query', {
          ...event,
          // TODO: we should probably change the interface to contain a proper array in the next major version.
          params: safeJsonStringify(event.params),
          // TODO: this field only exists for historical reasons as we grandfathered it from the time
          // when we emitted `tracing` events to stdout in the engine unchanged, and then described
          // them in the public API as TS types. Thus this field used to contain the name of the Rust
          // module in which an event originated. When using library engine, which uses a different
          // mechanism with a JavaScript callback for logs, it's normally just an empty string instead.
          // This field is definitely not useful and should be removed from the public types (but it's
          // technically a breaking change, even if a tiny and inconsequential one).
          target: 'ClientEngine',
        } satisfies ClientQueryEvent)
      }
    }
  }

  applyPendingMigrations(): Promise<void> {
    throw new Error('Cannot call applyPendingMigrations on engine type client.')
  }

  async #ensureStarted(): Promise<ConnectedEngine> {
    switch (this.#state.type) {
      case 'disconnected': {
        const connecting = this.tracingHelper.runInChildSpan('connect', async () => {
          let driverAdapter: SqlDriverAdapter | undefined = undefined
          let transactionManager: TransactionManager | undefined = undefined
          let queryCompiler: QueryCompiler | undefined = undefined

          try {
            driverAdapter = await this.#driverAdapterFactory.connect()
            transactionManager = this.#createTransactionManager(driverAdapter)
            queryCompiler = await this.#instantiateQueryCompiler(driverAdapter)
          } catch (error) {
            this.#state = { type: 'disconnected' }
            queryCompiler?.free()
            await driverAdapter?.dispose()
            throw error
          }

          const engine: ConnectedEngine = {
            driverAdapter,
            transactionManager,
            queryCompiler,
          }

          this.#state = { type: 'connected', engine }

          return engine
        })

        this.#state = {
          type: 'connecting',
          promise: connecting,
        }

        return await connecting
      }

      case 'connecting':
        return await this.#state.promise

      case 'connected':
        return this.#state.engine

      case 'disconnecting':
        await this.#state.promise
        return await this.#ensureStarted()
    }
  }

  #createTransactionManager(driverAdapter: SqlDriverAdapter): TransactionManager {
    return new TransactionManager({
      driverAdapter,
      transactionOptions: {
        ...this.config.transactionOptions,
        isolationLevel: this.#convertIsolationLevel(this.config.transactionOptions.isolationLevel),
      },
      tracingHelper: this.tracingHelper,
      onQuery: this.#emitQueryEvent,
    })
  }

  async #instantiateQueryCompiler(driverAdapter: SqlDriverAdapter): Promise<QueryCompiler> {
    // We reuse the `QueryCompilerConstructor` from the same `WebAssembly.Instance` between
    // reconnects as long as there are no panics. This avoids the overhead of loading and
    // JIT compiling the WebAssembly module after every reconnect. If it panics, we discard
    // it and load a new one from scratch if the client reconnects again.
    let QueryCompilerConstructor = this.#QueryCompilerConstructor

    if (QueryCompilerConstructor === undefined) {
      QueryCompilerConstructor = await this.#queryCompilerLoader.loadQueryCompiler(this.config)
      this.#QueryCompilerConstructor = QueryCompilerConstructor
    }

    const connectionInfo = driverAdapter?.getConnectionInfo?.() ?? { supportsRelationJoins: false }

    try {
      return this.#withLocalPanicHandler(
        () =>
          new QueryCompilerConstructor({
            datamodel: this.datamodel,
            provider: this.#driverAdapterFactory.provider,
            connectionInfo,
          }),
        undefined,
        false,
      )
    } catch (e) {
      throw this.#transformInitError(e)
    }
  }

  #transformInitError(err: Error): Error {
    if (err instanceof PrismaClientRustPanicError) {
      return err
    }
    try {
      const error: SyncRustError = JSON.parse(err.message)
      return new PrismaClientInitializationError(error.message, this.config.clientVersion, error.error_code)
    } catch (e) {
      return err
    }
  }

  #transformRequestError(err: any, query?: string): Error {
    if (err instanceof PrismaClientInitializationError) return err

    if (err.code === 'GenericFailure' && err.message?.startsWith('PANIC:'))
      return new PrismaClientRustPanicError(
        getErrorMessageWithLink(this, err.message, query),
        this.config.clientVersion,
      )

    if (err instanceof UserFacingError) {
      return new PrismaClientKnownRequestError(err.message, {
        code: err.code,
        meta: err.meta,
        clientVersion: this.config.clientVersion,
      })
    }

    try {
      const error: RustRequestError = JSON.parse(err as string)
      return new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
        clientVersion: this.config.clientVersion,
      })
    } catch (e) {
      return err
    }
  }

  #transformCompileError(error: any): any {
    if (error instanceof PrismaClientRustPanicError) {
      return error
    }
    if (typeof error['message'] === 'string' && typeof error['code'] === 'string') {
      return new PrismaClientKnownRequestError(error['message'], {
        code: error['code'],
        meta: error.meta,
        clientVersion: this.config.clientVersion,
      })
    } else {
      return error
    }
  }

  #withLocalPanicHandler<T>(fn: () => T, query?: string, disconnectOnPanic = true): T {
    const previousHandler = globalWithPanicHandler.PRISMA_WASM_PANIC_REGISTRY.set_message
    let panic: string | undefined = undefined

    global.PRISMA_WASM_PANIC_REGISTRY.set_message = (message: string) => {
      panic = message
    }

    try {
      return fn()
    } finally {
      global.PRISMA_WASM_PANIC_REGISTRY.set_message = previousHandler

      if (panic) {
        // Discard the current `WebAssembly.Instance` to avoid memory leaks:
        // WebAssembly doesn't unwind the stack or call destructors on panic.
        this.#QueryCompilerConstructor = undefined
        // Disconnect and drop the compiler, unless this panic happened during
        // initialization. In that case, we let `#ensureStarted` deal with it
        // and change the state to `disconnected` by itself.
        if (disconnectOnPanic) {
          void this.stop().catch((err) => debug('failed to disconnect:', err))
        }
        // eslint-disable-next-line no-unsafe-finally
        throw new PrismaClientRustPanicError(getErrorMessageWithLink(this, panic, query), this.config.clientVersion)
      }
    }
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the client engine, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.#ensureStarted()
  }

  async stop(): Promise<void> {
    switch (this.#state.type) {
      case 'disconnected':
        return

      case 'connecting':
        await this.#state.promise
        return await this.stop()

      case 'connected': {
        const engine = this.#state.engine

        const disconnecting = this.tracingHelper.runInChildSpan('disconnect', async () => {
          try {
            await engine.transactionManager.cancelAllTransactions()
            await engine.driverAdapter.dispose()
            engine.queryCompiler.free()
          } finally {
            this.#state = { type: 'disconnected' }
          }
        })

        this.#state = {
          type: 'disconnecting',
          promise: disconnecting,
        }

        return await disconnecting
      }

      case 'disconnecting':
        return await this.#state.promise
    }
  }

  version(): string {
    return 'unknown'
  }

  async transaction(
    action: 'start',
    headers: Tx.TransactionHeaders,
    options: Tx.Options,
  ): Promise<Tx.InteractiveTransactionInfo<undefined>>
  async transaction(
    action: 'commit',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  async transaction(
    action: 'rollback',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  async transaction(
    action: 'start' | 'commit' | 'rollback',
    _headers: Tx.TransactionHeaders,
    arg?: any,
  ): Promise<Tx.InteractiveTransactionInfo<undefined> | undefined> {
    let result: TransactionInfo | undefined

    const { transactionManager } = await this.#ensureStarted()

    try {
      if (action === 'start') {
        const options: Tx.Options = arg
        result = await transactionManager.startTransaction({
          ...options,
          isolationLevel: this.#convertIsolationLevel(options.isolationLevel),
        })
      } else if (action === 'commit') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await transactionManager.commitTransaction(txInfo.id)
      } else if (action === 'rollback') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await transactionManager.rollbackTransaction(txInfo.id)
      } else {
        assertNever(action, 'Invalid transaction action.')
      }
    } catch (error) {
      throw this.#transformRequestError(error)
    }

    return result ? { id: result.id, payload: undefined } : undefined
  }

  async request<T>(query: JsonQuery, { interactiveTransaction }: RequestOptions<undefined>): Promise<{ data: T }> {
    debug(`sending request`)
    const queryStr = JSON.stringify(query)

    const { driverAdapter, transactionManager, queryCompiler } = await this.#ensureStarted().catch((err) => {
      throw this.#transformRequestError(err, queryStr)
    })

    let queryPlan: QueryPlanNode
    try {
      queryPlan = this.#withLocalPanicHandler(() => queryCompiler.compile(queryStr), queryStr) as QueryPlanNode
    } catch (error) {
      throw this.#transformCompileError(error)
    }

    try {
      debug(`query plan created`, queryPlan)

      const queryable = interactiveTransaction
        ? transactionManager.getTransaction(interactiveTransaction, 'query')
        : driverAdapter

      const qiTransactionManager = (
        interactiveTransaction ? { enabled: false } : { enabled: true, manager: transactionManager }
      ) satisfies QueryInterpreterTransactionManager

      // TODO: ORM-508 - Implement query plan caching by replacing all scalar values in the query with params automatically.
      const placeholderValues = {}
      const interpreter = QueryInterpreter.forSql({
        transactionManager: qiTransactionManager,
        placeholderValues,
        onQuery: this.#emitQueryEvent,
        tracingHelper: this.tracingHelper,
      })
      const result = await interpreter.run(queryPlan, queryable)

      debug(`query plan executed`)

      return { data: { [query.action]: result } as T }
    } catch (e: any) {
      throw this.#transformRequestError(e, queryStr)
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, traceparent: _traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    if (queries.length === 0) {
      return []
    }
    const firstAction = queries[0].action

    const request = JSON.stringify(getBatchRequestPayload(queries, transaction))

    const { transactionManager, queryCompiler } = await this.#ensureStarted().catch((err) => {
      throw this.#transformRequestError(err, request)
    })

    let batchResponse: BatchResponse
    try {
      batchResponse = queryCompiler.compileBatch(request)
    } catch (err) {
      throw this.#transformCompileError(err)
    }

    try {
      let txInfo: InteractiveTransactionInfo<undefined>
      if (transaction?.kind === 'itx') {
        // If we are already in an interactive transaction we do not nest transactions
        txInfo = transaction.options
      } else {
        const txOptions = transaction?.options.isolationLevel
          ? { ...this.config.transactionOptions, isolationLevel: transaction.options.isolationLevel }
          : this.config.transactionOptions
        txInfo = await this.transaction('start', {}, txOptions)
      }

      // TODO: ORM-508 - Implement query plan caching by replacing all scalar values in the query with params automatically.
      const placeholderValues = {}
      const interpreter = QueryInterpreter.forSql({
        transactionManager: { enabled: false },
        placeholderValues,
        onQuery: this.#emitQueryEvent,
        tracingHelper: this.tracingHelper,
      })
      const queryable = transactionManager.getTransaction(txInfo, 'batch query')

      let results: BatchQueryEngineResult<unknown>[] = []
      switch (batchResponse.type) {
        case 'multi': {
          results = await Promise.all(
            batchResponse.plans.map((plan, i) =>
              interpreter.run(plan as QueryPlanNode, queryable).then(
                (rows) => ({ data: { [queries[i].action]: rows } }),
                (err) => err,
              ),
            ),
          )
          break
        }
        case 'compacted': {
          if (!queries.every((q) => q.action === firstAction)) {
            throw new Error('All queries in a batch must have the same action')
          }

          const rows = await interpreter.run(batchResponse.plan as QueryPlanNode, queryable)
          results = this.#convertCompactedRows(rows as {}[], batchResponse, firstAction)
          break
        }
      }

      if (transaction?.kind !== 'itx') {
        await this.transaction('commit', {}, txInfo)
      }

      return results as BatchQueryEngineResult<T>[]
    } catch (e: any) {
      throw this.#transformRequestError(e, request)
    }
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(_options: EngineMetricsOptions): Promise<Metrics | string> {
    throw new Error('Method not implemented.')
  }

  /**
   * Converts the result of a compacted query back to result objects analogous to what queries
   * would return when executed individually.
   */
  #convertCompactedRows(
    rows: {}[],
    response: CompactedBatchResponse,
    action: string,
  ): BatchQueryEngineResult<unknown>[] {
    // a list of objects that contain the keys of every row
    const keysPerRow = rows.map((item) =>
      response.keys.reduce((acc, key) => {
        acc[key] = deserializeJsonResponse(item[key])
        return acc
      }, {}),
    )
    // the selections inferred from the request, used to filter unwanted columns from the results
    const selection = new Set(response.nestedSelection)

    return response.arguments.map((args) => {
      // we find the index of the row that matches the input arguments - this is the row we want
      // to return minus any extra columns not present in the selection
      const rowIndex = keysPerRow.findIndex((rowKeys) => doKeysMatch(rowKeys, args))
      if (rowIndex === -1) {
        if (response.expectNonEmpty) {
          return new PrismaClientKnownRequestError(
            'An operation failed because it depends on one or more records that were required but not found',
            {
              code: 'P2025',
              clientVersion: this.config.clientVersion,
            },
          )
        } else {
          return { data: { [action]: null } }
        }
      } else {
        const selected = Object.entries(rows[rowIndex]).filter(([k]) => selection.has(k))
        return { data: { [action]: Object.fromEntries(selected) } }
      }
    })
  }

  #convertIsolationLevel(clientIsolationLevel: Tx.IsolationLevel | undefined): SqlIsolationLevel | undefined {
    switch (clientIsolationLevel) {
      case undefined:
        return undefined
      case 'ReadUncommitted':
        return 'READ UNCOMMITTED'
      case 'ReadCommitted':
        return 'READ COMMITTED'
      case 'RepeatableRead':
        return 'REPEATABLE READ'
      case 'Serializable':
        return 'SERIALIZABLE'
      case 'Snapshot':
        return 'SNAPSHOT'
      default:
        throw new PrismaClientKnownRequestError(
          `Inconsistent column data: Conversion failed: Invalid isolation level \`${
            clientIsolationLevel satisfies never
          }\``,
          {
            code: 'P2023',
            clientVersion: this.config.clientVersion,
            meta: {
              providedIsolationLevel: clientIsolationLevel,
            },
          },
        )
    }
  }
}

function getErrorMessageWithLink(engine: ClientEngine, title: string, query?: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: undefined,
    title,
    version: engine.config.clientVersion,
    engineVersion: 'unknown', // WASM engines do not export their version info
    database: engine.config.activeProvider as any,
    query,
  })
}
